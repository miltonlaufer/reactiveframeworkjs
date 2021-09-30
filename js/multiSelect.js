'use strict';

import {Component} from "../classes/component.js";

// Here the idea is that we will have "doc" and "win" as aliases for "document" and "window"
let doc = document, win = window;

// The class that does the magic
export class multiSelect extends Component {
    constructor(props) {
        super(props);

        // Checks and sets general properties
        if (!this.state.data.hasOwnProperty('name')) {
            this.state.data.name = `multiSelect${this._id}`;
            console.warn(`Not name given to multiSelect object, default '${this.state.data.name} used instead`);
        }

        if (!this.state.data.hasOwnProperty('elements')) this.state.data.elements = [];

        if (!Array.isArray(this.state.data.elements)) throw 'The parameter "Elements" has to be an array';

        if (!this.state.data.hasOwnProperty('selectedElements')) this.state.data.selectedElements = [];
        // To restore the value after a search
        this.state.data.elementsBackup = this.state.data.elements;

        if (!Array.isArray(this.state.data.selectedElements)) throw 'The parameter "selectedElements" has to be an array';

        this.state.data.searchQuery = '';

        // Creates a callback when "elements" changes
        this.setComputed('elements', this.orderElements);
        // Todo should I keep this?
        this.ordered = false;
        // Orders the elements alphabetically TODO is this necessary?
        this.orderElements();

        // Adds the stylesheet if it wasn't added before
        if (!doc.getElementById('multiSelectStyle')) {
            let style = doc.createElement('link');
            style.setAttribute('type', 'text/css');
            style.setAttribute('rel', 'stylesheet');
            style.setAttribute('href', 'css/multiSelect.css');
            style.setAttribute('id', 'multiSelectStyle');
            doc.getElementsByTagName("head")[0].appendChild(style);
        }

        this.headerId = `${this.htmlId}--header`;

        this.classRegister(optionsWrapper, 'optionsWrapper');
        this.classRegister(title, 'title');
        this.classRegister(searchableInput, 'searchableInput');

        this.addChild({
            component: 'title',
            dataWatched: ['name', 'title'],
            parentElement: `#${this.headerId}`
        });

        this.state.data.unselectedCount = 0;

        this.addChild({
            component: 'searchableInput',
            dataWatched: ['searchQuery', 'unselectedCount'],
            parentElement: `#${this.headerId}`,
            ref: 'searchQuery'
        });

        this.addChild({
            component: 'optionsWrapper',
            dataWatched: ['elements', 'selectedElements', 'formElementName', 'name'],
            parentElement: `#${this.htmlId}`
        });

        if (props.hasOwnProperty('renderNow') && props.renderNow) {
            this.render();
        }
    }

    /**
     *
     * @returns {HTMLDivElement}
     */
    template() {
        let container = doc.createElement('div');
        container.classList.add('multiSelect__container');

        let header = doc.createElement('div');
        header.classList.add('multiSelect__header');
        header.setAttribute('id', this.headerId);

        let close = doc.createElement('span');
        close.classList.add('multiSelect__close');
        close.addEventListener('click', () => {
            this.destructor();
        });
        header.appendChild(close);
        container.appendChild(header);


        let footer = doc.createElement('div');
        footer.classList.add('multiSelect__footer');

        let submit = doc.createElement('button');
        submit.innerText = this.getState('confirmText') || 'Confirm'
        submit.classList.add('multiSelect__submit');
        this.setObjRef(submit, 'SubmitButton');

        let cancel = doc.createElement('button');
        cancel.innerText = this.getState('cancelText') || 'Cancel';
        cancel.classList.add('multiSelect__cancel');
        this.setObjRef(cancel, 'CancelButton');


        footer.appendChild(cancel);
        footer.appendChild(submit);
        container.appendChild(footer);

        // Changes the border color either for one elements or for all (the first one has priority)
        if (this.getState('color')) {
            container.style
                .setProperty('--multiSelect-color', this.getState('color'));
            container.style
                .setProperty('--multiSelect--circle-background-color', `${this.getState('color')}20`);
            container.style
                .setProperty('--multiSelect-color-hover', `${this.getState('color')}10`);
            container.style
                .setProperty('--multiSelect--tick-color', `${this.getState('color')}7a`);


        } else if (this.getState('allColors')) {
            doc.documentElement.style
                .setProperty('--multiSelect-color', this.getState('allColors'));
            doc.documentElement.style
                .setProperty('--multiSelect--circle-background-color', `${this.getState('allColors')}20`);
            doc.documentElement.style
                .setProperty('--multiSelect-color-hover', `${this.getState('allColors')}10`);
            doc.documentElement.style
                .setProperty('--multiSelect--tick-color', `${this.getState('color')}7a`);
        }

        return container;
    }

    processDataChange() {
        let selectedJSON = this.getState('selectedElements').map(val => JSON.stringify(val));

        // Performs the search or restores all the elements if search is empty
        if (this.getState('searchQuery').trim().length === 0) {
            this.setState({
                elements: this.getState('elementsBackup')
            });
        } else {
            this.setState({
                elements: this.getState('elementsBackup').filter(
                    element => (
                        element.text.toLowerCase().includes(this.getState('searchQuery').toLowerCase())
                        &&
                        !selectedJSON.includes(JSON.stringify(element))
                    )
                )
            });
        }

        // calculates the unselected
        let unselectedCount = this.getState('elementsBackup') ?
            this.getState('elementsBackup').length - (this.getState('selectedElements') ?
            this.getState('selectedElements').length : 0)
            : 0;

        this.setState({unselectedCount}, true);
    }

    /**
     * Sets the color for a single multiSelector
     *
     * @param {String} color
     */
    setColor(color) {
        this.forceRendering = true;
        this.setState({color})
    }

    /**
     * Sets the color for all multiSelectors
     *
     * @param {String} allColors
     */
    setAllColors(allColors) {
        this.forceRendering = true;
        this.setState({allColors})
    }

    // Orders the elements
    orderElements() {
        if (this.ordered) {
            return;
        }

        // We sort the array
        this.state.data.elements.sort((a, b) => {
            return (a.text < b.text) ? -1 : (a.text > b.text) ? 1 : 0;
        });
        // To keep track of the order
        this.ordered = true;
    }

    /**
     * Add a single element to the selection list
     *
     * @param {String|Object} elem
     */
    addSingleElement(elem) {
        this.ordered = false;

        let myElem = elem;

        if (typeof myElem === 'string') {
            myElem = {text: myElem, value: myElem};
        }

        // Keep a backup
        this.state.data.elementsBackup = [...this.getState('elements'), myElem];

        this.setState({
            elements: this.getState('elementsBackup')
        });
    }

    /**
     * To set all the elements at once (after an ajax call, for instance)
     * The param is an array of objects
     *
     * @param {Array} elements
     */
    setElements(elements) {
        this.ordered = false;

        this.setState(
            {
                elements,
                elementsBackup: elements
            }
        );
    }

    /**
     * Unselects all the items
     */
    unselectElements() {
        this.setState({selectedElements: []});
    }

    /**
     * Removes the element (or elements) that matches the text
     *
     * @param {String} text
     */
    removeSingleElementByText(text) {
        this.state.data.elementsBackup = this.getState('elements').filter(opt => opt.text !== text)

        this.setState({
            elements: this.getState('elementsBackup')
        });
    }

    /**
     * Removes the element (or elements) that matches the value or id
     *
     * @param {String|Number} value
     */
    removeSingleElementByValue(value) {
        this.state.data.elementsBackup = this.getState('elements').filter(opt => opt.value !== value);

        this.setState({
            elements: this.getState('elementsBackup')
        });
    }

    /**
     * Sets the function that will be invoked when the confirm button is clicked
     *
     * @param {Function} myCallback
     */
    setConfirmCallback(myCallback) {
        this.getObjByRef('SubmitButton').addEventListener('click', myCallback)
    }

    /**
     * Sets the function that will be invoked when the cancel button is clicked
     *
     * @param {Function} myCallback
     */
    setCancelCallback(myCallback) {
        this.getObjByRef('CancelButton').addEventListener('click', myCallback)
    }

    /**
     * Get the selected elements
     *
     * @returns {Array} the selected elements
     */
    getSelectedElements() {
        return this.getState('selectedElements');
    }

}// class multiSelect

// The form element and the visual components
class optionsWrapper extends Component {
    constructor(props) {
        super(props);

        this.classRegister(optionHiddenObject, 'optionHiddenObject');
        this.classRegister(optionObject, 'optionObject');
        this.classRegister(noOptions, 'noOptions');

        this.ulName = `ul-${this._id}`;
        this.selectName = `select-${this._id}`;

        this.processDataChange();
    }

    template() {
        let container = doc.createElement('div');
        let ul = doc.createElement('ul');
        ul.setAttribute('id', this.ulName);

        let select = doc.createElement('select');
        select.style.display = 'none';
        select.setAttribute('multiple', '');
        select.setAttribute('id', this.selectName);
        select.setAttribute('name', this.getState('formElementName') ?
            this.getState('formElementName') : this.getState('name'));

        container.appendChild(ul);
        container.appendChild(select);

        return container;
    }

    processDataChange() {
        // todo fix this
        this.removeChildren();

        let elements = this.getState('elements');

        if (!Array.isArray(elements)) return;

        if (!elements.length) {
            this.addChild({
                component: 'noOptions',
                parentElement: `#${this.htmlId}`,
                data: {
                    elements: this.getState('elements')
                }
            });
        } else {
            for (let element of elements) {
                this.addChild({
                    parentElement: this.selectName,
                    data: {element},
                    component: 'optionHiddenObject',
                    dataWatched: ['selectedElements']
                });

                this.addChild({
                    parentElement: this.ulName,
                    data: {element},
                    component: 'optionObject',
                    dataWatched: ['selectedElements']
                })
            }
        }
    }
} // optionsWrapper

// The title
class title extends Component {
    template() {
        let noOpts = doc.createElement('h2');
        let titleText = this.getState('title');
        noOpts.innerText = titleText ? titleText : 'Assign Users To [[name]] List';

        return noOpts;
    }
} //title

// Searchable input
class searchableInput extends Component {
    template() {
        let container = doc.createElement('div');
        container.classList.add('custom-searchableInput--wrapper');


        let input = doc.createElement('input');
        input.setAttribute('type', 'search');
        input.classList.add('custom-searchableInput');
        input.setAttribute('placeholder',
            `Search ${this.getState('unselectedCount')} unselected items`);

        this.setObjRef(input, 'searchField');
        this.bindElementToData('searchQuery', input);

        let wrapper = doc.createElement('div');
        wrapper.classList.add('custom-searchableInput--magnifier--wrapper');

        let magnifier = doc.createElement('span');
        magnifier.classList.add('custom-searchableInput--magnifier');

        wrapper.appendChild(magnifier);

        container.appendChild(input);
        container.appendChild(wrapper);

        return container;
    }
} // searchableInput

// Used for components with no options
class noOptions extends Component {
    template() {
        let noOpts = doc.createElement('li')
        noOpts.innerText = 'No options to show';

        return noOpts;
    }
} // noOptions

// Each visible option
class optionObject extends Component {
    template() {
        let element = this.getState('element');
        if (element) {
            let li = doc.createElement('li');
            let text = this.getState('element').text;
            let secondLineText = this.getState('element').hasOwnProperty('secondLine') ?
                this.getState('element').secondLine : null;

            let circle = doc.createElement('div');
            circle.classList.add('multiSelect__option__circle');

            let initialsArray = text.trim().split(' ');
            circle.innerText = initialsArray.length > 1 ?
                initialsArray[0][0] + initialsArray[initialsArray.length - 1][0] : initialsArray[0][0];
            li.appendChild(circle);

            let textContainer = doc.createElement('div');
            textContainer.classList.add('multiSelect__option__text');

            let span = doc.createElement('span');
            span.innerText = text;
            textContainer.appendChild(span);

            if (secondLineText) {
                let secondLine = doc.createElement('span');
                secondLine.innerText = secondLineText;
                textContainer.appendChild(secondLine);
            }

            li.appendChild(textContainer);

            let tick = doc.createElement('span');
            tick.classList.add('multiSelect__option__tick');
            li.appendChild(tick);

            li.addEventListener('click', this.bindCallBack(this, this.selectMyselfCallback));

            if (this.getState('selectedElements').filter(
                elem => JSON.stringify(elem) === JSON.stringify(this.getState('element'))).length
            ) {
                li.classList.add('selected');
            }

            return li;
        } else {
            return '';
        }
    }

    selectMyselfCallback(e) {
        let selectedElements = this.getState('selectedElements');

        if (selectedElements.filter(
            elem => JSON.stringify(elem) === JSON.stringify(this.getState('element'))).length === 0) {
            this.setState({
                selectedElements: [...selectedElements, this.getState('element')]
            })
        } else {
            this.setState({
                selectedElements: selectedElements.filter(
                    elem => JSON.stringify(elem) !== JSON.stringify(this.getState('element')))
            });
        }

        // Workaround - todo check why the object doesn't get deleted
        this.destructor();
    }
} // optionObject

// Each form option
class optionHiddenObject extends Component {
    template() {
        let option = doc.createElement('option');
        option.innerText = this.getState('element').text;

        if (this.getState('selectedElements').includes(this.getState('element'))) {
            option.setAttribute('selected', 'selected');
        }

        return option;
    }
} // OptionHiddenObject


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Another way of instantiating the component: using a tag directly in the HTML
// https://w3c.github.io/webcomponents/spec/custom/
class multiSelectTag extends HTMLElement {
    constructor() {
        super();

        // Create a shadow root, encapsulated
        this.shadow = this.attachShadow({mode: 'open'});

        // Creates and adds the stylesheet
        let style = document.createElement('style');
        style.innerHTML = `
        @import 'css/multiSelect.css'
        `;
        this.shadow.appendChild(style);

        // create and attach the main div to the shadow dom. We need this class
        // as otherwise the multiSelect will overwrite the styles
        this.main = document.createElement('div');
        this.shadow.appendChild(this.main);
    }

    // When the element is connected
    connectedCallback() {
        let elements = this.getAttribute('elements');
        let name = this.getAttribute('name');

        let elementsSanitized = elements ? elements.split('|').map(
            val => {
                val = val.replace(/\'/g, '"');

                let element = '';

                try {
                    element = JSON.parse(val.trim());
                } catch (e) {
                    console.warn('The "elements" attribute is not well formatted. Check if is a valid JSON: '
                        + e.message);
                }

                return element;
            }
        ).filter(val => val.length !== 0) : [];

        this.multiSelect = new multiSelect({
            data: {
                elements: elementsSanitized,
                name
            },
            elem: this.main,
            renderNow: true,
            shadow: this.shadow
        });
    }

    // Check if the elements are being modified externally
    static get observedAttributes() {
        return ["elements"];
    }

    // Attribute change callback
    attributeChangedCallback(attr, oldVal, newVal) {
        if (attr === 'elements' && oldVal !== newVal && this.multiSelect) {
            this.multiSelect.setState({elements: newVal})
        }
    }

    // Fires when an instance was removed from the document.
    disconnectedCallback() {
        this.multiSelect.destructor();
    }
} // class multiSelectDom

// Define the new tag element
customElements.define('multi-select', multiSelectTag);
