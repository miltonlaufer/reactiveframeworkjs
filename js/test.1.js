'use strict';

import {Component} from "../classes/component.js";

/**
 * THIS EXAMPLE SHOWS HOW EASY IS TO BIND A DATA (this.state.data) TO AN ELEMENT
 * INPUT HTML ELEMENTS, WHEN THEY ARE BOUND TO CERTAIN DATA BY this.bindElementData('NAMEofDATA'..., objVarName)
 * EVERY OBJECT GETS UPDATED AUTOMATICALLY
 */


// Here the idea is that we will have "doc" and "win" as aliases for "document" and "window"
let doc = document, win = window;

// The class that does the magic
export class test extends Component {
    constructor(props) {
        super(props);

        console.log(this);
        if (!this.state.data) this.state.data = {};
        if (!this.state.data.hasOwnProperty('text')) this.state.data.text = '';

        // Add the class 'span' to use it
        this.classRegister(span, 'span');
        // Add it as a child
        this.addChild({
            component: 'span',
            dataWatched: ['text'],
            parentElement: `${this.state.elem}`
        });

        // Add the class 'h1' to use it
        this.classRegister(h1, 'h1');
        // Add it as a child
        this.addChild({
            component: 'h1',
            dataWatched: ['text'],
            parentElement: `${this.state.elem}`
        });

        this.render();
    }

    // THIS CREATES THE VIEW
    template() {
        let container = doc.createElement('div');
        let input = doc.createElement('input');
        input.setAttribute('placeholder', 'write something here');
        this.bindElementToData('text', input);
        container.appendChild(input);
        container.appendChild(doc.createElement('br'));
        container.appendChild(doc.createElement('br'));

        return container;
    }
}

class span extends Component{
    template() {
        let span = doc.createElement('span');
        span.innerText = this.getState('text');

        return span;
    }
}

class h1 extends Component{
    template() {
        let container = doc.createElement('div');
        container.appendChild(doc.createElement('br'));
        container.appendChild(doc.createElement('br'));

        let h1 = doc.createElement('h1');
        h1.innerText = this.getState('text');

        container.appendChild(h1);

        return container;
    }
}
