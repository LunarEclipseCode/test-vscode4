/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { BugIndicatingError } from '../../common/errors.js';
import { DisposableStore } from '../../common/lifecycle.js';
import { derived, derivedOpts, observableValue } from '../../common/observable.js';
import { isSVGElement } from '../dom.js';
export var n;
(function (n) {
    function nodeNs(elementNs = undefined) {
        return (tag, attributes, children) => {
            const className = attributes.class;
            delete attributes.class;
            const ref = attributes.ref;
            delete attributes.ref;
            const obsRef = attributes.obsRef;
            delete attributes.obsRef;
            return new ObserverNodeWithElement(tag, ref, obsRef, elementNs, className, attributes, children);
        };
    }
    function node(tag, elementNs = undefined) {
        const f = nodeNs(elementNs);
        return (attributes, children) => {
            return f(tag, attributes, children);
        };
    }
    n.div = node('div');
    n.elem = nodeNs(undefined);
    n.svg = node('svg', 'http://www.w3.org/2000/svg');
    n.svgElem = nodeNs('http://www.w3.org/2000/svg');
    function ref() {
        let value = undefined;
        const result = function (val) {
            value = val;
        };
        Object.defineProperty(result, 'element', {
            get() {
                if (!value) {
                    throw new BugIndicatingError('Make sure the ref is set before accessing the element. Maybe wrong initialization order?');
                }
                return value;
            }
        });
        return result;
    }
    n.ref = ref;
})(n || (n = {}));
export class ObserverNode {
    constructor(tag, ref, obsRef, ns, className, attributes, children) {
        this._deriveds = [];
        this._element = (ns ? document.createElementNS(ns, tag) : document.createElement(tag));
        if (ref) {
            ref(this._element);
        }
        if (obsRef) {
            this._deriveds.push(derived((_reader) => {
                obsRef(this);
                _reader.store.add({
                    dispose: () => {
                        obsRef(null);
                    }
                });
            }));
        }
        if (className) {
            if (hasObservable(className)) {
                this._deriveds.push(derived(this, reader => {
                    /** @description set.class */
                    setClassName(this._element, getClassName(className, reader));
                }));
            }
            else {
                setClassName(this._element, getClassName(className, undefined));
            }
        }
        for (const [key, value] of Object.entries(attributes)) {
            if (key === 'style') {
                for (const [cssKey, cssValue] of Object.entries(value)) {
                    const key = camelCaseToHyphenCase(cssKey);
                    if (isObservable(cssValue)) {
                        this._deriveds.push(derivedOpts({ owner: this, debugName: () => `set.style.${key}` }, reader => {
                            this._element.style.setProperty(key, convertCssValue(cssValue.read(reader)));
                        }));
                    }
                    else {
                        this._element.style.setProperty(key, convertCssValue(cssValue));
                    }
                }
            }
            else if (key === 'tabIndex') {
                if (isObservable(value)) {
                    this._deriveds.push(derived(this, reader => {
                        /** @description set.tabIndex */
                        this._element.tabIndex = value.read(reader);
                    }));
                }
                else {
                    this._element.tabIndex = value;
                }
            }
            else if (key.startsWith('on')) {
                this._element[key] = value;
            }
            else {
                if (isObservable(value)) {
                    this._deriveds.push(derivedOpts({ owner: this, debugName: () => `set.${key}` }, reader => {
                        setOrRemoveAttribute(this._element, key, value.read(reader));
                    }));
                }
                else {
                    setOrRemoveAttribute(this._element, key, value);
                }
            }
        }
        if (children) {
            function getChildren(reader, children) {
                if (isObservable(children)) {
                    return getChildren(reader, children.read(reader));
                }
                if (Array.isArray(children)) {
                    return children.flatMap(c => getChildren(reader, c));
                }
                if (children instanceof ObserverNode) {
                    if (reader) {
                        children.readEffect(reader);
                    }
                    return [children._element];
                }
                if (children) {
                    return [children];
                }
                return [];
            }
            const d = derived(this, reader => {
                /** @description set.children */
                this._element.replaceChildren(...getChildren(reader, children));
            });
            this._deriveds.push(d);
            if (!childrenIsObservable(children)) {
                d.get();
            }
        }
    }
    readEffect(reader) {
        for (const d of this._deriveds) {
            d.read(reader);
        }
    }
    keepUpdated(store) {
        derived(reader => {
            /** update */
            this.readEffect(reader);
        }).recomputeInitiallyAndOnChange(store);
        return this;
    }
    /**
     * Creates a live element that will keep the element updated as long as the returned object is not disposed.
    */
    toDisposableLiveElement() {
        const store = new DisposableStore();
        this.keepUpdated(store);
        return new LiveElement(this._element, store);
    }
}
function setClassName(domNode, className) {
    if (isSVGElement(domNode)) {
        domNode.setAttribute('class', className);
    }
    else {
        domNode.className = className;
    }
}
function resolve(value, reader, cb) {
    if (isObservable(value)) {
        cb(value.read(reader));
        return;
    }
    if (Array.isArray(value)) {
        for (const v of value) {
            resolve(v, reader, cb);
        }
        return;
    }
    cb(value);
}
function getClassName(className, reader) {
    let result = '';
    resolve(className, reader, val => {
        if (val) {
            if (result.length === 0) {
                result = val;
            }
            else {
                result += ' ' + val;
            }
        }
    });
    return result;
}
function hasObservable(value) {
    if (isObservable(value)) {
        return true;
    }
    if (Array.isArray(value)) {
        return value.some(v => hasObservable(v));
    }
    return false;
}
function convertCssValue(value) {
    if (typeof value === 'number') {
        return value + 'px';
    }
    return value;
}
function childrenIsObservable(children) {
    if (isObservable(children)) {
        return true;
    }
    if (Array.isArray(children)) {
        return children.some(c => childrenIsObservable(c));
    }
    return false;
}
export class LiveElement {
    constructor(element, _disposable) {
        this.element = element;
        this._disposable = _disposable;
    }
    dispose() {
        this._disposable.dispose();
    }
}
export class ObserverNodeWithElement extends ObserverNode {
    constructor() {
        super(...arguments);
        this._isHovered = undefined;
        this._didMouseMoveDuringHover = undefined;
    }
    get element() {
        return this._element;
    }
    get isHovered() {
        if (!this._isHovered) {
            const hovered = observableValue('hovered', false);
            this._element.addEventListener('mouseenter', (_e) => hovered.set(true, undefined));
            this._element.addEventListener('mouseleave', (_e) => hovered.set(false, undefined));
            this._isHovered = hovered;
        }
        return this._isHovered;
    }
    get didMouseMoveDuringHover() {
        if (!this._didMouseMoveDuringHover) {
            let _hovering = false;
            const hovered = observableValue('didMouseMoveDuringHover', false);
            this._element.addEventListener('mouseenter', (_e) => {
                _hovering = true;
            });
            this._element.addEventListener('mousemove', (_e) => {
                if (_hovering) {
                    hovered.set(true, undefined);
                }
            });
            this._element.addEventListener('mouseleave', (_e) => {
                _hovering = false;
                hovered.set(false, undefined);
            });
            this._didMouseMoveDuringHover = hovered;
        }
        return this._didMouseMoveDuringHover;
    }
}
function setOrRemoveAttribute(element, key, value) {
    if (value === null || value === undefined) {
        element.removeAttribute(camelCaseToHyphenCase(key));
    }
    else {
        element.setAttribute(camelCaseToHyphenCase(key), String(value));
    }
}
function camelCaseToHyphenCase(str) {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}
function isObservable(obj) {
    return !!obj && obj.read !== undefined && obj.reportChanges !== undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvYmFzZS9icm93c2VyL2RvbUltcGwvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUM1RCxPQUFPLEVBQUUsZUFBZSxFQUFlLE1BQU0sMkJBQTJCLENBQUM7QUFDekUsT0FBTyxFQUFFLE9BQU8sRUFBRSxXQUFXLEVBQXdCLGVBQWUsRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQ3pHLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFFekMsTUFBTSxLQUFXLENBQUMsQ0E0Q2pCO0FBNUNELFdBQWlCLENBQUM7SUFDakIsU0FBUyxNQUFNLENBQW1DLFlBQWdDLFNBQVM7UUFDMUYsT0FBTyxDQUFDLEdBQUcsRUFBRSxVQUFVLEVBQUUsUUFBUSxFQUFFLEVBQUU7WUFDcEMsTUFBTSxTQUFTLEdBQUcsVUFBVSxDQUFDLEtBQUssQ0FBQztZQUNuQyxPQUFPLFVBQVUsQ0FBQyxLQUFLLENBQUM7WUFDeEIsTUFBTSxHQUFHLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQztZQUMzQixPQUFPLFVBQVUsQ0FBQyxHQUFHLENBQUM7WUFDdEIsTUFBTSxNQUFNLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQztZQUNqQyxPQUFPLFVBQVUsQ0FBQyxNQUFNLENBQUM7WUFFekIsT0FBTyxJQUFJLHVCQUF1QixDQUFDLEdBQVUsRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQ3pHLENBQUMsQ0FBQztJQUNILENBQUM7SUFFRCxTQUFTLElBQUksQ0FBNEQsR0FBUyxFQUFFLFlBQWdDLFNBQVM7UUFDNUgsTUFBTSxDQUFDLEdBQUcsTUFBTSxDQUFDLFNBQVMs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