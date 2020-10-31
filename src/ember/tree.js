import {
  emberNode,
  emberParameter,
  emberParameterContents,
  emberQualifiedNode,
  emberQualifiedParameter,
} from './types.js';

/**
 * Private base class for all ember tree nodes.
 */
class TreeNode {
  /**
   * Parent node. null inside of the RootNode.
   */
  get parent() {
    return this._parent;
  }

  /**
   * Node number. This is equal to the position
   * inside the parent children array plus one.
   *
   * @returns {number}
   */
  get number() {
    return this._number;
  }

  /**
   * The node identifier name.
   *
   * @returns {string}
   */
  get identifier() {
    return this._identifier;
  }

  /**
   * The node numeric path.
   *
   * @returns {number[]}
   */
  get numericPath() {
    let path = this._numericPath;

    if (path !== null) return path;

    const parent = this._parent;

    path = [this.number];

    if (parent !== null) path = parent.numericPath.concat(path);

    this._numericPath = path;

    return path;
  }

  /**
   * The node identifier path.
   *
   * @return {string[]}
   */
  get identifierPath() {
    let path = this._identifierPath;

    if (path !== null) return path;

    const parent = this._parent;

    path = [this.identifier];

    if (parent !== null && !(parent instanceof RootNode))
      path = parent.identifierPath.concat(path);

    this._identifierPath = path;

    return path;
  }

  /** @internal */
  get key() {
    return this._key;
  }

  /** @internal */
  constructor(parent, number, identifier) {
    this._parent = parent || null;
    this._number = number;
    this._identifier = identifier;
    this._numericPath = null;
    this._identifierPath = null;
    this._key = this.numericPath.join('.');
    this._propertyObservers = [];
  }

  /**
   * Subscribe to property change events on this node.
   *
   * @param {Function} callback
   *    Whenever a property changes, the callback function will be called
   *    with property name and value as arguments.
   * @returns {Function}
   *    Returns a function, which can be called to remove the subscription.
   */
  subscribePropertyChanged(callback) {
    const observers = this._propertyObservers;

    if (observers.includes(callback)) throw new Error('Already subscribed.');

    observers.push(callback);

    return () => {
      this._propertyObservers = this._propertyObservers.filter(
        (_cb) => _cb !== callback
      );
    };
  }

  /**
   * Observe the given property. Will be called for each property change
   * and also initially if the property exists.
   *
   * @param {string} name
   *    The property name.
   * @param {Function} callback
   *    Whenever the property changes, the callback function will be called
   *    with the value.
   * @returns {Function}
   *    Returns a function, which can be called to remove the subscription.
   */
  observeProperty(name, callback) {
    if (this[name] !== void 0) callback(this[name]);
    return this.subscribePropertyChanged((_name, value) => {
      if (name !== _name) return;
      callback(value);
    });
  }

  /** @internal */
  propertyChanged(name, value) {
    const observers = this._propertyObservers;

    for (let i = 0; i < observers.length; i++) {
      try {
        observers[i](name, value);
      } catch (error) {
        console.error(error);
      }
    }
  }
}

/**
 * Base class for nodes with children, i.e. RootNode and Node.
 */
export class InternalNode extends TreeNode {
  /**
   * Returns the list of children. The list of children may not
   * have been received, yet, in which case this list is empty.
   *
   * The childrenReceived property will be set to `true` by the
   * Device when the list of children has been received.
   */
  get children() {
    return this._children;
  }

  /** @internal */
  set childrenReceived(value) {
    this._childrenReceived = !!value;
  }

  /**
   * True if the `children` property contains the actual list of
   * children.
   */
  get childrenReceived() {
    return this._childrenReceived;
  }

  /** @internal */
  constructor(parent, number, identifier) {
    super(parent, number, identifier);
    this._children = [];
    this._childrenReceived = false;
  }

  /** @internal */
  addChild(child) {
    const children = this._children;
    const index = child.number - 1;

    const previous = children[index];

    children[index] = child;

    return previous;
  }

  /** @internal */
  removeChild(child) {
    const children = this._children;
    const index = child.number - 1;
    const previous = children[index];

    if (previous !== child) throw new Error('Removing wrong child.');

    children[index] = void 0;
  }

  /** @internal */
  removeAllChildren() {
    this._children.length = 0;
  }
}

/**
 * Tree node for ember nodes. Contains children which are other
 * nodes or parameter nodes.
 */
export class Node extends InternalNode {
  /** @internal */
  getQualifiedNode() {
    return emberQualifiedNode.from({
      path: this.numericPath,
    });
  }

  /**
   * The ember node description field.
   */
  get description() {
    return this._description;
  }

  /**
   * The ember node isRoot field.
   *
   * If true, this is not the root node of the device, but rather a root node.
   * For example, according to the ember specification nodes should be marked
   * as root nodes if they represent other devices inside of a proxy.
   */
  get isRoot() {
    return this._isRoot;
  }

  /**
   * The ember node isOnline field.
   */
  get isOnline() {
    return this._isOnline;
  }

  /** @internal */
  constructor(parent, number, contents) {
    super(parent, number, contents.identifier);
    this._description = contents.description;
    this._isRoot = contents.isRoot;
    this._isOnline = contents.isOnline !== false;
  }

  /** @internal */
  static from(parent, node) {
    if (node instanceof emberNode) {
      return new this(parent, node.number, node.contents);
    } else if (node instanceof emberQualifiedNode) {
      const number = node.path[node.path.length - 1];
      return new this(parent, number, node.contents);
    } else {
      throw new TypeError('Unsupported node type.');
    }
  }

  /** @internal */
  updateFrom(contents) {
    for (const name in contents) {
      const value = contents[name];

      if (value !== void 0 && value !== this[name]) {
        this['_' + name] = value;
        this.propertyChanged(name, value);
      }
    }
  }
}

/**
 * Special tree node for the root node. This node exists in ember only
 * implicitly.
 */
export class RootNode extends InternalNode {
  get numericPath() {
    return [];
  }

  get identifierPath() {
    return [];
  }

  /** @internal */
  constructor() {
    super(null, -1, null);
  }
}

/**
 * Tree node representing ember parameter nodes.
 */
export class Parameter extends TreeNode {
  /** @internal */
  getQualifiedParameter() {
    return emberQualifiedParameter.from({
      path: this.numericPath,
    });
  }

  /** @internal */
  getSetValue(value) {
    const result = emberQualifiedParameter.from({
      path: this.numericPath,
      contents: new emberParameterContents({
        value: value,
      }),
    });
    return result;
  }

  /**
   * The ember parameter description field.
   *
   * @returns {string}
   */
  get description() {
    return this._description;
  }

  /**
   * The ember parameter value field.
   *
   * @returns {string|number|boolean}
   */
  get value() {
    return this._value;
  }

  /**
   * The ember parameter minimum field.
   *
   * @returns {number}
   */
  get minimum() {
    return this._minimum;
  }

  /**
   * The ember parameter maximum field.
   *
   * @returns {number}
   */
  get maximum() {
    return this._maximum;
  }

  /**
   * The ember parameter access field. Either 'none', 'read', 'write' or 'readWrite'.
   *
   * @return {string}
   */
  get access() {
    return this._access;
  }

  /**
   * The ember parameter format field.
   *
   * @return {string}
   */
  get format() {
    return this._format;
  }

  /**
   * The ember parameter enumeration field.
   *
   * @return {string}
   */
  get enumeration() {
    return this._enumeration;
  }

  /**
   * The ember parameter factor field.
   *
   * @return {number}
   */
  get factor() {
    return this._factor;
  }

  /**
   * The ember parameter isOnline field.
   *
   * @return {boolean}
   */
  get isOnline() {
    return this._isOnline;
  }

  /**
   * The ember parameter formula field.
   *
   * @return {string}
   */
  get formula() {
    return this._formula;
  }

  /**
   * The ember parameter step field.
   *
   * @return {number}
   */
  get step() {
    return this._step;
  }

  /**
   * The ember parameter default field.
   *
   * @return {number|string|boolean}
   */
  get default() {
    return this._default;
  }

  /**
   * The ember parameter type field. One of 'integer', 'real', 'string',
   * 'boolean', 'trigger', 'enum' or 'octets'.
   *
   * @return {number|string|boolean}
   */
  get type() {
    return this._type;
  }

  /**
   * The ember parameter streamIdentifier field.
   *
   * @return {number}
   */
  get streamIdentifier() {
    return this._streamIdentifier;
  }

  /**
   * The ember parameter enumMap field.
   *
   * @return {(number|string}[]}
   */
  get enumMap() {
    return this._enumMap;
  }

  /**
   * The ember parameter streamDescription field.
   *
   * @return {Object}
   */
  get streamDescriptor() {
    return this._streamDescriptor;
  }

  /**
   * The effective value, e.g. the value property transformed according
   * to the parameter information.
   */
  get effectiveValue() {
    return this.toEffectiveValue(this._value);
  }

  /**
   * The effective minimum, e.g. the minimum property transformed according
   * to the parameter information.
   */
  get effectiveMinimum() {
    return this.toEffectiveValue(this._minimum);
  }

  /**
   * The effective maximum, e.g. the maximum property transformed according
   * to the parameter information.
   */
  get effectiveMaximum() {
    return this.toEffectiveValue(this._maximum);
  }

  /**
   * Transform from ember value (e.g. the value property) to
   * the corresponding effective value. This function essentially
   * applies the the `factor` and interprets the `enumeration` list.
   */
  toEffectiveValue(value) {
    if (value === void 0) return this._default;

    const factor = this._factor;

    if (factor !== void 0 && factor !== 0) {
      return value / factor;
    }

    const enumeration = this._enumeration;

    if (enumeration) return enumeration.split('\n')[value];

    return value;
  }

  /**
   * Transform from effective value to ember value.
   */
  fromEffectiveValue(value) {
    const factor = this._factor;

    if (factor !== void 0 && factor !== 0) return value * factor;

    const enumeration = this._enumeration;

    if (enumeration !== void 0) {
      const pos = enumeration.split('\n').indexOf(value);

      if (pos === -1) throw new Error('Unknown enum entry.');

      return pos;
    }

    return value;
  }

  /** @internal */
  constructor(parent, number, contents) {
    super(parent, number, contents.identifier);
    this._description = contents.description;
    this._value = contents.value;
    this._minimum = contents.minimum;
    this._maximum = contents.maximum;
    this._access = contents.access;
    this._format = contents.format;
    this._enumeration = contents.enumeration;
    this._factor = contents.factor;
    this._isOnline = contents.isOnline !== false;
    this._formula = contents.formula;
    this._step = contents.step;
    this._default = contents.default;
    this._type = contents.type;
    this._streamIdentifier = contents.streamIdentifier;
    this._enumMap = contents.enumMap;
    this._streamDescriptor = contents.streamDescriptor;
  }

  /** @internal */
  updateFrom(contents) {
    for (const name in contents) {
      const value = contents[name];

      if (value !== void 0 && value !== this[name]) {
        this['_' + name] = value;
        this.propertyChanged(name, value);
      }
    }
  }

  /** @internal */
  updateValue(value) {
    this._value = value;
    this.propertyChanged('value', value);
  }

  /** @internal */
  static from(parent, parameter) {
    if (parameter instanceof emberParameter) {
      return new this(parent, parameter.number, parameter.contents);
    } else if (parameter instanceof emberQualifiedParameter) {
      const number = parameter.path[parameter.path.length - 1];
      return new this(parent, number, parameter.contents);
    } else {
      throw new TypeError('Unsupported parameter type.');
    }
  }

  /**
   * Observe the effective value.
   *
   * @param {Function} callback
   */
  observeEffectiveValue(callback) {
    return this.observeProperty('value', (value) => {
      callback(this.toEffectiveValue(value));
    });
  }

  /**
   * Observe the effective minimum value.
   *
   * @param {Function} callback
   */
  observeEffectiveMinimum(callback) {
    return this.observeProperty('minimum', (value) => {
      callback(this.toEffectiveValue(value));
    });
  }

  /**
   * Observe the effective maximum value.
   *
   * @param {Function} callback
   */
  observeEffectiveMaximum(callback) {
    return this.observeProperty('maximum', (value) => {
      callback(this.toEffectiveValue(value));
    });
  }
}
