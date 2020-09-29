import {
  emberNode,
  emberParameter,
  emberParameterContents,
  emberQualifiedNode,
  emberQualifiedParameter,
} from './types.js';

class TreeNode {
  get parent() {
    return this._parent;
  }

  get number() {
    return this._number;
  }

  get identifier() {
    return this._identifier;
  }

  get numericPath() {
    let path = this._numericPath;

    if (path !== null) return path;

    const parent = this._parent;

    path = [this.number];

    if (parent !== null) path = parent.numericPath.concat(path);

    this._numericPath = path;

    return path;
  }

  get identifierPath() {
    let path = this._identifierPath;

    if (path !== null) return path;

    const parent = this._parent;

    path = this.identifier;

    if (parent !== null && !(parent instanceof RootNode))
      path = parent.identifierPath + this._separator + path;

    this._identifierPath = path;

    return path;
  }

  get key() {
    return this._key;
  }

  constructor(parent, number, identifier, separator) {
    this._parent = parent || null;
    this._number = number;
    this._identifier = identifier;
    this._numericPath = null;
    this._identifierPath = null;
    this._key = this.numericPath.join('.');
    this._propertyObservers = [];
    this._separator = separator;
  }

  subscribePropertyChanged(callback) {
    const observers = this._propertyObservers;

    if (observers.includes(callback)) throw new Error('Already subscribed.');

    observers.push(callback);

    return () => {
      const observers = this._propertyObservers;
      this._propertyObservers = observers.filter(_cb !== callback);
    };
  }

  observeProperty(name, callback) {
    if (this[name] !== void 0) callback(this[name]);
    return this.subscribePropertyChanged((_name, value) => {
      if (name !== _name) return;
      callback(value);
    });
  }

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

class TreeNodeWithChildren extends TreeNode {
  constructor(parent, number, identifier, separator) {
    super(parent, number, identifier, separator);
    this.children = [];
  }

  addChild(child) {
    const children = this.children;
    const index = child.number;

    const previous = children[index];

    children[index] = child;

    return previous;
  }

  removeChild(child) {
    const children = this.children;
    const index = child.number;
    const previous = children[index];

    if (previous !== child) throw new Error('Removing wrong child.');

    children[index] = void 0;
  }

  removeAllChildren() {
    this.children.length = 0;
  }
}

export class Node extends TreeNodeWithChildren {
  getQualifiedNode() {
    return emberQualifiedNode.from({
      path: this.numericPath,
    });
  }

  get description() {
    return this._description;
  }

  get isRoot() {
    return this._isRoot;
  }

  get isOnline() {
    return this._isOnline;
  }

  constructor(parent, number, contents, separator) {
    super(parent, number, contents.identifier, separator);
    this._description = contents.description;
    this._isRoot = contents.isRoot;
    this._isOnline = contents.isOnline !== false;
  }

  static from(parent, node, separator) {
    if (node instanceof emberNode) {
      return new this(parent, node.number, node.contents, separator);
    } else if (node instanceof emberQualifiedNode) {
      const number = node.path[node.path.length - 1];
      return new this(parent, number, node.contents, separator);
    } else {
      throw new TypeError('Unsupported node type.');
    }
  }

  updateFrom(contents) {
    for (let name in contents) {
      const value = contents[name];

      if (value !== void 0 && value !== this[name]) {
        this['_' + name] = value;
        this.propertyChanged(name, value);
      }
    }
  }
}

export class RootNode extends TreeNodeWithChildren {
  get numericPath() {
    return [];
  }

  get identifierPath() {
    return '/';
  }

  constructor(separator) {
    super(null, -1, null, separator);
  }
}

export class Parameter extends TreeNode {
  getQualifiedParameter() {
    return emberQualifiedParameter.from({
      path: this.numericPath,
    });
  }

  getSetValue(value) {
    const result = emberQualifiedParameter.from({
      path: this.numericPath,
      contents: new emberParameterContents({
        value: value,
      }),
    });
    return result;
  }

  get description() {
    return this._description;
  }

  get value() {
    return this._value;
  }

  get minimum() {
    return this._minimum;
  }

  get maximum() {
    return this._maximum;
  }

  get access() {
    return this._access;
  }

  get format() {
    return this._format;
  }

  get enumeration() {
    return this._enumeration;
  }

  get factor() {
    return this._factor;
  }

  get isOnline() {
    return this._isOnline;
  }

  get formula() {
    return this._formula;
  }

  get step() {
    return this._step;
  }

  get default() {
    return this._default;
  }

  get type() {
    return this._type;
  }

  get streamIdentifier() {
    return this._streamIdentifier;
  }

  get enumMap() {
    return this._enumMap;
  }

  get streamDescriptor() {
    return this._streamDescriptor;
  }

  get effectiveValue() {
    const value = this._value;

    if (value === void 0) return this._default;

    const factor = this._factor;

    if (factor !== void 0 && factor !== 0) {
      return value / factor;
    }

    const enumeration = this._enumeration;

    if (enumeration) return enumeration.split('\n')[value];

    return value;
  }

  fromEffectiveValue(value) {
    const factor = this._factor;

    if (factor !== void 0 && factor !== 0) return value * factor;

    const enumeration = this._enumeration;

    if (enumeration !== void 0) {
      let pos = enumeration.split('\n').indexOf(value);

      if (pos === -1) throw new Error('Unknown enum entry.');

      return pos;
    }

    return value;
  }

  constructor(parent, number, contents, separator) {
    super(parent, number, contents.identifier, separator);
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

  updateFrom(contents) {
    for (let name in contents) {
      const value = contents[name];

      if (value !== void 0 && value !== this[name]) {
        this['_' + name] = value;
        this.propertyChanged(name, value);
      }
    }
  }

  static from(parent, parameter, separator) {
    if (parameter instanceof emberParameter) {
      return new this(parent, parameter.number, parameter.contents, separator);
    } else if (parameter instanceof emberQualifiedParameter) {
      const number = parameter.path[parameter.path.length - 1];
      return new this(parent, number, parameter.contents, separator);
    } else {
      throw new TypeError('Unsupported parameter type.');
    }
  }

  observeEffectiveValue(callback) {
    const value = this.effectiveValue;

    if (value !== void 0) callback(value);

    return this.subscribePropertyChanged(() => {
      callback(this.effectiveValue);
    });
  }
}
