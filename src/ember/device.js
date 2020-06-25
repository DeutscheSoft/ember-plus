import {
  emberCommand,
  emberNode,
  emberParameter,
  emberQualifiedNode,
  emberQualifiedParameter,
} from './types.js';
import { Node, Parameter } from './tree.js';

function getKey(element) {
  if (element instanceof emberNode || element instanceof emberParameter) {
    return '' + element.number;
  } else {
    return element.path.join('.');
  }
}

export class Device {
  _createParameter(parent, element) {
    const parameter = Parameter.from(parent, element);

    this._nodes.set(parameter.key, parameter);

    const identifierPath = parameter.identifierPath;

    this._nodesByPath.set(identifierPath, parameter);
    this._onNodeChanged(identifierPath, parameter);
  }

  _createNode(parent, element) {
    const node = Node.from(parent, element);

    this._nodes.set(node.key, node);

    const identifierPath = node.identifierPath;

    this._nodesByPath.set(identifierPath, node);
    this._onNodeChanged(identifierPath, node);

    this.connection.sendGetDirectory(node.getQualifiedNode());

    return node;
  }

  _getParent(path) {
    let parent;

    if (path.length) {
      parent = this._nodes.get(path.join('.'));

      if (!parent) throw new Error('Could not find parent.');

      if (!(parent instanceof Node)) throw new Error('Expected Node parent.');
    } else {
      parent = null;
    }

    return parent;
  }

  _handleNodeElement(nodeElement, parentPath) {
    const path = parentPath.concat([nodeElement.number]);
    let node = this._nodes.get(path.join('.'));

    if (!node) {
      const parent = this._getParent(parentPath);

      node = this._createNode(parent, nodeElement);
    } else {
      // update
      if (nodeElement.contents) node.updateFrom(nodeElement.contents);
    }

    if (nodeElement.children === void 0) return;

    console.log('children', nodeElement.children);
    nodeElement.children.list.forEach((element) => {
      this._handleElement(element, path);
    });
  }

  _handleQualifiedNodeElement(nodeElement) {
    const path = nodeElement.path;
    const node = this._nodes.get(path.join('.'));

    if (!node) throw new Error('Unknown qualified node.');

    // update
    if (nodeElement.contents) node.updateFrom(nodeElement.contents);

    if (nodeElement.children === void 0) return;

    nodeElement.children.list.forEach((element) => {
      this._handleElement(element, path);
    });
  }

  _handleParameterElement(parameterElement, parentPath) {
    const path = parentPath.concat([parameterElement.number]);
    let parameter = this._nodes.get(path.join('.'));

    if (!parameter) {
      const parent = this._getParent(parentPath);

      parameter = this._createParameter(parent, parameterElement);
    } else {
      // update
      if (parameterElement.contents !== void 0)
        parameter.updateFrom(parameterElement.contents);
    }
  }

  _handleQualifiedParameterElement(parameterElement) {
    const path = parameterElement.path;
    const parameter = this._nodes.get(path.join('.'));

    if (!parameter) throw new Error('Unknown qualified parameter');

    // update
    if (parameterElement.contents !== void 0)
      parameter.updateFrom(parameterElement.contents);
  }

  _handleElement(element, path) {
    if (element instanceof emberNode) {
      this._handleNodeElement(element, path);
    } else if (element instanceof emberParameter) {
      this._handleParameterElement(element, path);
    } else {
      throw new TypeError('Unsupported type.');
    }
  }

  _handleRootElement(element) {
    if (element instanceof emberNode) {
      this._handleNodeElement(element, []);
    } else if (element instanceof emberParameter) {
      this._handleParameterElement(element, []);
    } else if (element instanceof emberQualifiedNode) {
      this._handleQualifiedNodeElement(element);
    } else if (element instanceof emberQualifiedParameter) {
      this._handleQualifiedParameterElement(element);
    } else {
      throw new TypeError('Unsupported type.');
    }
  }

  _onNodeChanged(path, node) {
    const observers = this._pathObservers;

    const list = observers.get(path);

    if (list === void 0) return;

    for (let i = 0; i < list.length; i++) {
      try {
        list[i](node);
      } catch (error) {
        console.error(error);
      }
    }
  }

  constructor(connection) {
    this.connection = connection;

    // contains all nodes by TreeNode.key
    this._nodes = new Map();

    // contains all nodes by TreeNode.identifierPath
    this._nodesByPath = new Map();

    // contains subscribers for a given path
    this._pathObservers = new Map();

    connection.sendGetDirectory();
    console.log('send get directory');

    connection.onerror = (error) => {
      console.error('Error in device connection', error);
    };
    connection.onRootElement = (element) => {
      if (element instanceof emberCommand) {
      } else if (
        element instanceof emberParameter ||
        element instanceof emberQualifiedParameter ||
        element instanceof emberNode ||
        element instanceof emberQualifiedNode
      ) {
        this._handleRootElement(element);
      } else {
        console.warn('Ignored root element', element);
      }
    };
    connection.sendKeepaliveRequest();
  }

  observePath(path, callback) {
    if (typeof path !== 'string') throw new TypeError('Expected string.');
    if (typeof callback !== 'function')
      throw new TypeError('Expected function.');

    const observers = this._pathObservers;

    let list = observers.get(path);

    let innerSubscription = null;

    if (!list) {
      observers.set(path, (list = []));
    }

    const cb = (node) => {
      if (innerSubscription !== null) {
        try {
          innerSubscfiption();
        } catch (err) {
          console.error(err);
        }
      }

      innerSubscription = callback(node) || null;
    };

    list.push(cb);

    const node = this._nodesByPath.get(path);

    if (node !== void 0) {
      try {
        cb(node);
      } catch (error) {
        console.log(error);
      }
    }

    return () => {
      if (callback === null) return;
      callback = null;
      const observers = this._pathObservers;
      const list = observers.get(path);

      observers.set(
        path,
        list.filter((_cb) => _cb !== cb)
      );
    };
  }

  setValue(parameter, value) {
    this.connection.sendRoot(parameter.getSetValue(value));
  }

  setEffectiveValue(parameter, value) {
  }
}
