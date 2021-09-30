'use strict';

// Here the idea is that we will have "doc" and "win" as aliases for "document" and "window"
let doc = document, win = window;

// A General class for our objects
// The following is a version of https://medium.com/@iamwill.us/yet-another-post-about-creating-components-with-es6-vanilla-javascript-e57eca42f611
// Basically keeps track of the current state of objects and only re-renders them if it's needed.
export class Component {
    /**
     * Create the Component object
     *
     * The props parameter has to have:
     *
     * elem: the element to make it into component
     * data (optionl): initial state
     *
     * @param {Object} props    The element to make into a component
     */
    constructor(props) {
        if (this.constructor.name === 'Component') throw 'The class Component is only meant to be extended';

        this.debugging = false;

        if (!props.elem) throw 'Component: You did not provide an element to make into a component.';

        // Just to know if it was created as a custom tag, then we will need to modify the queries, that why the base
        this.shadow = props.shadow ? props.shadow : false;
        this.base = props.shadow ? props.shadow : document;

        if (typeof doc.componentRegistry === 'undefined') {
            doc.componentRegistry = {} // We keep a track of components
        }

        if (typeof doc.nextId === 'undefined') {
            doc.nextId = 0;             // initial id
        }

        this._id = ++doc.nextId; // creating a unique id
        doc.componentRegistry[this._id] = this; // assigning id for every new component created
        this.renderTimes = 0; // For debugging and testing

        this.htmlId = `component${this.constructor.name}Num${this._id}`;
        this.ref = props.ref; // Can be null

        if (typeof props.elem === 'string' && props.elem.indexOf('#') !== 0) {
            props.elem = '#' + props.elem;
        }

        // This is the character we'll use to find variables [[varName]] (modified from original). Assignable in case
        // the backend framework (i.e.: Django, laravel) already uses those characters in its templates
        this.varCharacterLeft = '[';
        this.varCharacterRight = ']';

        if (props.hasOwnProperty('varCharacter') && props.varCharacter.length === 2) {
            this.varCharacterLeft = props.varCharacter[0];
            this.varCharacterRight = props.varCharacter[1];
        }

        // forces re rendering (for special cases)
        this.forceRendering = false;

        this.state = {  // defining the initial state
            elem: props.elem, // the target dom elem we will be injecting the component into.
            data: props.data || null, // the data we want to pass to our component or null,
            previousData: Object.assign({}, props.data) || null, // We keep a log of the old data (modification
            // from original class). It copies the object.
            previousTemplate: null, // Keep the state of the old template. Useful not to re render an object if only
                                    // its children have been modified (modification of original class)
            children: [],           // (modification of original class),
            childrenRefs: {},       // Easy access to particular children by REF attribute TODO remove this?
            childrenWatchedData: {},// An object that keeps track of the watchedData for the children, (mod),
            parentComponent: props.hasOwnProperty('parentComponent') ? props.parentComponent : null,
            inheritedParameters: props.hasOwnProperty('inheritedParameters') && props.inheritedParameters ? props.inheritedParameters : [],
            computedData: {}       // Watches certain data and invokes a callback functions if it changes
        }

        // In order to instantiate them dynamically (modification from original)
        this.registeredClasses = {};
    }

    /**
     * Register a class (modification from original)
     *
     * @param {Function} theClass
     * @param {String} alias
     */
    classRegister(theClass, alias) {
        this.registeredClasses[alias] = theClass;
    }

    /**
     * Deregister a class (modification from original)
     *
     * @param {Function} theClass
     * @param {String} alias
     */
    classDeregister(theClass, alias) {
        delete this.registeredClasses[alias];
    }

    /**
     * Binds value of the htmlElement with the value of the object state property
     * (modification from original class)
     *
     * @param {String} dataKey the key in this.data.state
     * @param {String|Element} htmlElement the id of the HTML element, or the element itself
     */
    bindElementToData(dataKey, htmlElement) {
        let obj = this.getDOMObject(htmlElement);

        // An extra event in case of INPUT fields
        if (obj.nodeName === 'INPUT') {
            if (obj.getAttribute('type') === 'search') {
                obj.addEventListener('search', this.bindCallBack(this, this.dataChangedCallback));
            }

            obj.addEventListener('keyup', this.bindCallBack(this, this.dataChangedCallback));
        }

        obj.addEventListener('change', this.bindCallBack(this, this.dataChangedCallback))

        obj.setAttribute('bound', dataKey);

        obj.value = this.getState(dataKey);

        return obj;
    }

    /**
     * Invoked when bound data has changed
     *
     * @param {ExceptionInformation} e
     */
    dataChangedCallback(e) {
        let obj = e.target;
        let boundTo = obj.getAttribute('bound');
        let value = obj.value;
        let newValue = {};
        newValue[boundTo] = value;

        this.setState(newValue);
    }

    /**
     * A helper for event binding  https://stackoverflow.com/a/193853
     *
     * @param scope The scope to bound with
     * @param {Function} fn The function that will be bound
     * @returns {function(...[*]=)}
     */
    bindCallBack(scope, fn) {
        return function () {
            fn.apply(scope, arguments);
        };
    }

    /**
     * Adds an element to the references object
     *
     * @param {Element} htmlElement the DOM object
     * @param {String} refName the reference
     */
    setObjRef(htmlElement, refName) {
        if (htmlElement && typeof refName === 'string') {
            try {
                htmlElement.setAttribute('ref', refName);
            } catch (e) {
                this.throwError('setObjRef error. Perhaps the htmlElement is not a DOM element?', e);
            }

            this.state.childrenRefs[refName] = htmlElement;
        }
    }

    /**
     * Gets an element by ref
     *
     * @param {String} ref the reference
     * @param {Element|null} base the base element
     * @returns {Element|throwError} a DOM object
     */
    getObjByRef(ref, base = null) {
        let root = base ? base : this.getDOMObject(this.state.elem);
        let obj = root.querySelector(`[ref="${ref}"]`);

        if (obj) return obj;

        this.throwError(`It seems there's no object ${ref} invoked in getObjByRef`);
    }

    /**
     * Set the internal variables of the object and its children, if they are bound
     *
     * @param {Object} props An object with the data to set
     * @param {Boolean} dontReRender (optional) prevents a rerender, even if the data changes
     */
    setState(props, dontReRender = false) {
        // Keep track if any data has to passed to the children
        this.dataModified = false;
        let childrenWatching = [];
        let returnToParent = {}

        // merge new properties into state object
        for (let key in props) {
            if (JSON.stringify(this.getState(key)) !== JSON.stringify(props[key])) {
                this.state.data[key] = props[key];
                this.dataModified = true; // This prevents children to be updated in case the data wasn't modified
                                          // but still there was a render call; see render() -

                // Sets what has to be passed to the children
                // The main idea of doing this is that if we pass each data that has
                // changed, the Component will re-render many times. Doing it this way
                // we only pass the data once, so only re-renders once.
                if (this.state.childrenWatchedData.hasOwnProperty(key)) {
                    for (let child of this.state.childrenWatchedData[key]) {
                        if (!childrenWatching.hasOwnProperty(child._id)) {
                            childrenWatching[child._id] = {};
                        }

                        childrenWatching[child._id][key] = props[key];
                    }
                }

                // Check which data has to updated in the parentComponent
                if (this.state.inheritedParameters.includes(key)) {
                    returnToParent[key] = props[key];
                }

                if (this.state.computedData.hasOwnProperty(key)) {
                    if (typeof this.state.computedData[key] === 'function') {
                        this.state.computedData[key].apply(this);
                    }
                }
            }
        }
        // trigger a re-render if data changed (modification from original class)
        if (this.dataModified) {
            this.state.previousData = Object.assign({}, this.state.data); // saves the current state, by value

            for (let id in childrenWatching) {
                doc.componentRegistry[id].setState(childrenWatching[id]);
            }

            // Returns the inherited data to the father. Won't create a loop as setState checks for changes
            if (Object.keys(returnToParent).length > 0) {
                this.state.parentComponent.setState(returnToParent);
            }

            if (!dontReRender) {
                this.processDataChange();
                this.render(); // basically updating the UI with the new state, this function is down below.
            }
        }
    }


    /**
     * Sets the function that will be triggered when certain data changes
     *
     * @param {String} key The key of the parameter to watch
     * @param {Function} theFunction The function that will be invoked
     */
    setComputed(key, theFunction) {
        this.state.computedData[key] = this.bindCallBack(this, theFunction);
    }

    /**
     * gets a particular object from the data state or the entire data
     * (modification of original class)
     *
     * @param {String|null} prop The key
     * @returns {String|Object} the value or values
     */
    getState(prop = null) {
        let output;

        if (prop) {
            output = this.state.data.hasOwnProperty(prop) ? this.state.data[prop] : null;
        } else {
            output = this.state.data;
        }

        return output;
    }

    /**
     *   Sets single child (modification of original class)
     *
     * A child is an object consisting in these properties
     * {
     *   {String|Function} component: theComponentObject (either its alias or the instantiated object itself)
     *   {Array} dataWatched: the data should be passed to the component when it changes (optional),
     *   {String} parentElement: the html id of the parent element,
     *   {Object} data: the initial data (optional)
     *   {String} ref: saves the object in the this.childrenRefs obj with the string as key, for easy access
     * }
     *
     * @param {Object} child
     */
    addChild(child) {
        if (child && typeof child === 'object') {
            if (!child.hasOwnProperty('parentElement'))
                this.throwError(`a child of ${child.component} component has no parentElement.`);

            let component = child.component;
            let notInstantiated = false;
            let data = {};


            if (typeof child.component === 'string') {
                if (!this.registeredClasses.hasOwnProperty(child.component))
                    this.throwError(`The class '${child.component}' invoked in ${this.constructor.name} is not registered`);

                notInstantiated = true;
                component = (doc.nextId + 1).toString() + Math.ceil(Math.random() * 1e20).toString();
            }

            if (child.hasOwnProperty('dataWatched')) {
                for (let key of child.dataWatched) {
                    if (!this.state.childrenWatchedData.hasOwnProperty(key)) {
                        this.state.childrenWatchedData[key] = [];
                    }

                    if (!this.state.childrenWatchedData[key].includes(component)) {
                        this.state.childrenWatchedData[key].push(component);
                    }

                    if (this.state.data.hasOwnProperty(key)) {
                        data[key] = this.getState(key);
                    }
                }
            }

            if (child.hasOwnProperty('data')) {
                Object.assign(data, child.data);
            }


            if (notInstantiated) {
                child.component = new this.registeredClasses[child.component]({
                    data,
                    elem: child.parentElement,
                    shadow: this.shadow,
                    ref: child.ref,
                    parentComponent: this,
                    inheritedParameters: child.dataWatched
                });

                if (child.hasOwnProperty('dataWatched')) {
                    for (let key of child.dataWatched) {
                        this.state.childrenWatchedData[key][this.state.childrenWatchedData[key].indexOf(component)] = child.component;
                    }
                }
            }

            this.state.children.push(child);
        }
    }

    /**
     *  Removes a particular child (modification of original class)
     * @param {Object} child
     */
    removeChild(child) {
        if (child) {
            this.state.children = this.state.children.filter(obj => {
                if (obj !== child.component) {
                    return true;
                }

                if (child.dataWatched && child.dataWatched.length) {
                    for (let key of child.dataWatched) {
                        let index = this.state.childrenWatchedData[key].indexOf(child);

                        if (index !== -1) {
                            delete this.state.childrenWatchedData[index];
                        }
                    }
                }

                return false;
            });

            child.component.destructor();
        }
    }

    // Removes all the children (modification of original class)
    removeChildren() {
        for (let child of this.state.children) {
            child.component.destructor();
        }

        this.state.children = [];
        this.state.childrenWatchedData = {};
    }


    // Gets the template string. HAS to be overwritten (modification of original class)
    template() { // this is where our template markup will go.
        return null;
    }

    // Here is where most of the logic is done. To be overwritten (modified from original)
    processDataChange() {
        // Insert your logic in
    }

    /**
     * Render the children of component (modification of original class)
     * @return {null}
     */
    renderChildren() {
        /** @var {Component} child **/
        for (let child of this.state.children) {
            child.component.render();
        }
    }

    /**
     * Parses any variable in the template (modified from original)
     * TODO parse also variables in attributes
     *
     * @param template
     * @returns {Element}
     */
    parseVariables(template) {
        // Wrapper needed to get the the outerHTML if the Element wasn't appended yet (first rendering)
        let wrapper = doc.createElement('div');
        wrapper.appendChild(template);
        let html = template.outerHTML;
        let regSearch = new RegExp(`\\${this.varCharacterLeft}{2}[a-zA-Z0-9]+\\${this.varCharacterRight}{2}`);

        if (regSearch.test(html)) {
            // Ok, there are variables to parse
            let nodesWithVariables = Array.from(wrapper.querySelectorAll('*')) // idea from https://stackoverflow.com/a/45869942
                .filter(el => regSearch.test(el.innerText));

            let boundChars = new RegExp(`[\\${this.varCharacterLeft}\\${this.varCharacterRight}]`, 'g');

            if (nodesWithVariables) {
                for (let node of nodesWithVariables) {
                    node.innerText = node.innerText.replace(regSearch, found => {
                        return this.getState(found.replace(boundChars, ''));
                    })
                }
            }
        }
    }

    /**
     * Render a template into the DOM
     * TODO improve this function to prevent unnecessary re-renders
     *
     * @return {Element|String} The element
     */
    render() {
        const elem = this.state.elem; // here we're grabbing the elem

        if (!elem) this.throwError(`It seems you forgot to set the parent element`);

        let _elem = this.getDOMObject(elem);

        if (!_elem) this.throwError(`${elem} is not a DOM object and didn't produce any by searching it.`);

        let previousObj = this.base.querySelector(`#${this.htmlId}`);

        // Get the template
        /** @var {Element} _template **/
        let _template = this.template();

        if (!_template) this.throwError(`No template in object id ${this._id}`);

        _template.setAttribute('id', this.htmlId);

        if (this.ref) {
            _template.setAttribute('ref', this.ref);
        }

        this.parseVariables(_template);

        if (
            !this.forceRendering &&
            !this.dataModified
            &&
            (previousObj
                &&
                this.base.contains(previousObj)
            )
            &&
            (
                previousObj.innerHTML === _template.innerHTML
                ||
                (this.state.previousTemplate && this.state.previousTemplate === _template.innerHTML)
            )
        ) {
            this.renderChildren();
            this.forceRendering = false;
            return;
        }


        // Updates or inserts the obj
        if (previousObj) {
            previousObj.parentNode.replaceChild(_template, previousObj);
        } else {
            _elem.appendChild(_template);
        }

        this.state.previousTemplate = _template.innerHTML; // and also the previous state (modification)

        // Dispatch a render event -> https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent
        if (typeof win.CustomEvent === 'function') {
            let event = new CustomEvent('render', {
                bubbles: true
            });
            _elem.dispatchEvent(event);
        }

        this.renderChildren(); // Renders the children (modification of original class)
        this.renderTimes++;
        this.warns(`${this.htmlId} rendered ${this.renderTimes} times`);


        // Resets the modified state
        this.dataModified = false;

        this.forceRendering = false;

        // Return the _elem for use elsewhere
        return _elem;
    } // render

    /**
     * A helper for debugging
     *
     * @param {String} text
     */
    warns(text) {
        if (this.debugging) console.warn(text)
    }

    /**
     * A helper for errors
     *
     * @param {String} text
     * @param {Function|Null} e
     */
    throwError(text, e = null) {
        throw `ERROR in component id ${this._id}, class "${this.constructor.name}": ${text} \n ${e &&
        e.hasOwnProperty('message') ? e.message : ''}`;
    }

    /**
     * A helper to get the actual DOM element
     *
     * @param {Element|String} obj
     * @returns {Element}
     */
    getDOMObject(obj) {
        let output = obj;

        if (typeof obj === 'string') {
            let id = obj;

            if (obj.indexOf('#') !== 0) {
                id = `#${obj}`;
            }

            output = this.base.querySelector(id);
        }

        return output;
    }

    // Let's deregister the object. This has to be called manually, except in case
    // the children of Components (modification of original class)
    destructor() {
        this.removeChildren();
        delete doc.componentRegistry[this._id]

        this.getDOMObject(this.htmlId).remove();
        delete this;
    }

} // class Component
