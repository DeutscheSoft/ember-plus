import {
  emberCommand,
  emberNode,
  emberParameter,
  emberQualifiedNode,
  emberQualifiedParameter,
} from './types.js';
import { Node, Parameter, RootNode } from './tree.js';

function getKey(element) {
  if (element instanceof emberNode || element instanceof emberParameter) {
    return '' + element.number;
  } else {
    return element.path.join('.');
  }
}

export class Device {
  _registerNode(treeNode) {
    this._nodes.set(treeNode.key, treeNode);

    const identifierPath = treeNode.identifierPath;

    this._nodesByPath.set(identifierPath, treeNode);
    this._onNodeChanged(identifierPath, treeNode);

    const parent = treeNode.parent;

    if (!parent) return;

    parent.addChild(treeNode);
  }

  _unregisterNode(treeNode) {
    this._nodes.delete(treeNode.key);

    const identifierPath = treeNode.identifierPath;

    this._nodesByPath.delete(identifierPath);
    this._onNodeChanged(identifierPath, null);

    const parent = treeNode.parent;

    if (!parent) return;

    parent.removeChild(treeNode);
  }

  _createParameter(parent, element) {
    const parameter = Parameter.from(parent, element, this.separator);

    this._registerNode(parameter);

    return parameter;
  }

  _createRootNode() {
    const node = new RootNode(this.separator);
    this._registerNode(node);
    return node;
  }

  _createNode(parent, element) {
    const node = Node.from(parent, element, this.separator);

    this._registerNode(node);

    const identifierPath = node.identifierPath;

    if (this._observerCount.get(identifierPath) > 0) {
      this._triggerGetDirectory(node.numericPath);
    }

    return node;
  }

  _getParent(path) {
    let parent;

    const nodes = this._nodes;

    parent = nodes.get(path.join('.'));

    if (!parent) throw new Error('Could not find parent.');

    if (!(parent instanceof Node) && !(parent instanceof RootNode))
      throw new Error('Expected Node parent.');

    return parent;
  }

  _removeAllChildren(parentNode) {
    parentNode.children.forEach((child) => {
      if (child instanceof Node) {
        this._removeAllChildren(child);
      }
      this._unregisterNode(child);
    });
    parentNode.removeAllChildren();
  }

  _removeNodeRecursively(node) {
    if (node instanceof Node) this._removeAllChildren(node);

    this._unregisterNode(node);
  }

  _handleNodeElement(nodeElement, parentPath) {
    const path = parentPath.concat([nodeElement.number]);
    const key = path.join('.');
    let node = this._nodes.get(key);

    if (node instanceof Parameter) {
      this._removeNodeRecursively(node);
      node = null;
    }

    // this changes all paths of children below this node. it is best to remove
    // them all
    if (
      node &&
      nodeElement.contents &&
      node.identifier !== nodeElement.contents.identifier
    ) {
      this._removeNodeRecursively(node);
      node = null;
    }

    if (!node) {
      const parent = this._getParent(parentPath);

      node = this._createNode(parent, nodeElement);
    } else {
      // update
      if (nodeElement.contents) {
        node.updateFrom(nodeElement.contents);

        if (!node.isOnline && node.children.length) {
          this._removeAllChildren(node);
        }
      }
    }

    if (nodeElement.children === void 0) return;

    nodeElement.children.list.forEach((element) => {
      this._handleElement(element, path);
    });
  }

  _handleQualifiedNodeElement(nodeElement) {
    const path = nodeElement.path;
    const key = path.join('.');
    const node = this._nodes.get(key);

    this._receivedGetDirectory(path);

    if (!node) {
      // we do not care about this node
      this.connection.sendUnsubscribe(nodeElement);
      return;
    }

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

    if (parameter instanceof Node) {
      this._removeNodeRecursively(parameter);
      parameter = null;
    }

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

    if (!parameter) {
      // we do not care about this node
      this.connection.sendUnsubscribe(
        emberQualifiedParameter.from({ path: parameterElement.path })
      );
      return;
    }

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
    // If we receive nodes or parameters, we assume this was in response to a
    // getDirectory request. If not, this is not bad, it only means we would
    // send more getDirectory requests than necessary.
    if (element instanceof emberNode) {
      this._receivedGetDirectory(null);
      this._handleNodeElement(element, []);
    } else if (element instanceof emberParameter) {
      this._receivedGetDirectory(null);
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

  _increaseObserverCount(path) {
    const a = path.split(this.separator);
    const observerCount = this._observerCount;

    const hasNode = !!this.getNodeByPath(path);
    let lastNode = null;

    for (let i = 1; i < a.length; i++) {
      const partialPath = a.slice(0, i).join(this.separator);
      let n = 0 | observerCount.get(partialPath);

      n++;

      observerCount.set(partialPath, n);

      if (hasNode) continue;

      const node = this.getNodeByPath(partialPath);

      if (node && node instanceof Node) {
        lastNode = node;
      }
    }

    if (hasNode) return;

    this._triggerGetDirectory(lastNode ? lastNode.numericPath : null);
  }

  _decreaseObserverCount(path) {
    const a = path.split(this.separator);
    const observerCount = this._observerCount;

    for (let i = 1; i < a.length; i++) {
      const partialPath = a.slice(0, i).join(this.separator);
      let n = 0 | observerCount.get(partialPath);

      if (n > 1) {
        observerCount.set(partialPath, n - 1);
      } else {
        observerCount.delete(partialPath);

        const node = this.getNodeByPath(partialPath);

        if (!node || !(node instanceof Node)) continue;

        // we are no longer interested in this node, so we remove it
        this.connection.sendUnsubscribe(node.getQualifiedNode());
        this._removeNodeRecursively(node);
      }
    }
  }

  _receivedGetDirectory(path) {
    const key = path === null ? '' : path.join('.');
    const getDirectoryPending = this._getDirectoryPending;
    getDirectoryPending.delete(key);
  }

  _triggerGetDirectory(path) {
    const key = path === null ? '' : path.join('.');
    const getDirectoryPending = this._getDirectoryPending;

    if (getDirectoryPending.has(key)) return;

    getDirectoryPending.add(key);

    if (path === null) {
      this.connection.sendGetDirectory();
    } else {
      const qualifiedNode = emberQualifiedNode.from({
        path: path,
      });

      this.connection.sendGetDirectory(qualifiedNode);
    }
  }

  constructor(connection, separator) {
    this.connection = connection;
    this.separator = separator || '/';

    // contains all nodes by TreeNode.key
    this._nodes = new Map();

    // contains all nodes by TreeNode.identifierPath
    this._nodesByPath = new Map();

    // contains subscribers for a given path
    this._pathObservers = new Map();

    // contains counts of observers for each identifierPath.
    // This includes all parent paths up to the root
    this._observerCount = new Map();

    // addresses for which a getDirectory request is currently pending
    this._getDirectoryPending = new Set();

    this._triggerGetDirectory(null);

    this._createRootNode();

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

  getNodeByPath(path) {
    return this._nodesByPath.get(path);
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
          innerSubscription();
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

    this._increaseObserverCount(path);

    return () => {
      if (callback === null) return;
      callback = null;
      const observers = this._pathObservers;
      const list = observers.get(path);

      observers.set(
        path,
        list.filter((_cb) => _cb !== cb)
      );
      this._decreaseObserverCount(path);
    };
  }

  /**
   * Set the value of a parameter.
   *
   * @param {Parameter} parameter The parameter node.
   * @param {*} value The new value.
   * @return void
   */
  setValue(parameter, value) {
    this.connection.sendRoot(parameter.getSetValue(value));
  }

  /**
   * Set the value of a parameter. Here value is the `effective value` instead
   * of the raw one. This means that any transformation specified in the
   * Parameter is reversed. For instance, this can be used to set an enum using
   * the enumeration name instead of the value.
   *
   * @param {Parameter} parameter The parameter node.
   * @param {*} value The new value.
   * @return void
   */
  setEffectiveValue(parameter, value) {
    this.setValue(parameter, parameter.fromEffectiveValue(value));
  }

  close() {
    this.connection.close();
  }
}
