import {
  emberCommand,
  emberNode,
  emberParameter,
  emberQualifiedNode,
  emberQualifiedParameter,
} from './types.js';
import { InternalNode, Node, Parameter, RootNode } from './tree.js';

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

    const parent = treeNode.parent;

    if (!parent) return;

    this._childrenChanged.add(parent);
    parent.addChild(treeNode);
  }

  _unregisterNode(treeNode) {
    this._nodes.delete(treeNode.key);

    const identifierPath = treeNode.identifierPath;

    const parent = treeNode.parent;

    this._notifyDirectoryObservers(treeNode);

    if (!parent) return;

    this._childrenChanged.add(parent);
    parent.removeChild(treeNode);
  }

  _createParameter(parent, element) {
    const parameter = Parameter.from(parent, element);

    this._registerNode(parameter);

    return parameter;
  }

  _createRootNode() {
    const node = new RootNode();
    this._registerNode(node);
    return node;
  }

  _createNode(parent, element) {
    const node = Node.from(parent, element);

    this._registerNode(node);

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

  _triggerGetDirectory(numericPath) {
    if (numericPath.length === 0) {
      this.connection.sendGetDirectory();
    } else {
      const qualifiedNode = emberQualifiedNode.from({
        path: numericPath,
      });

      this.connection.sendGetDirectory(qualifiedNode);
    }
  }

  _onRootElements(elements) {
    this._receiving = true;

    try {
      elements.forEach((element) => {
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
      });
    } catch (err) {
      console.error(err);
    } finally {
      this._receiving = false;
      this._processChildrenChanged();
    }
  }

  get root() {
    return this._root;
  }

  constructor(connection) {
    this.connection = connection;

    // contains all nodes by TreeNode.key
    this._nodes = new Map();

    // Map<Node, Set<function>>
    this._directoryObservers = new Map();

    // Contains all nodes for which new children
    // have been received.
    // Set<Node>
    this._childrenChanged = new Set();

    this._root = this._createRootNode();

    this._receiving = false;

    connection.onerror = (error) => {
      console.error('Error in device connection', error);
    };
    connection.onRootElements = (elements) => {
      this._onRootElements(elements);
    };
    connection.sendKeepaliveRequest();
  }

  _notifyDirectoryObservers(node) {
    const observers = this._directoryObservers.get(node);

    if (!observers) return;

    const deleted = this._nodes.get(node.key) !== node;

    observers.forEach((callback) => {
      try {
        callback(deleted ? null : node);
      } catch (err) {
        console.error(err);
      }
    });
  }

  _processChildrenChanged() {
    const childrenChanged = this._childrenChanged;
    const children = Array.from(childrenChanged);
    childrenChanged.clear();

    // TODO: need to sort by tree order?
    // children.sort((nodea, nodeb) => {});
    children.forEach((node) => {
      node.childrenReceived = true;
      this._notifyDirectoryObservers(node);
    });
  }

  /**
   * Observes directory changes of the given node. The callback
   * will be called whenever the children of this node change
   * and once initially if children have already been received.
   *
   * When the given node is removed (e.g. because a parent node
   * has gone offline), the callback is called with null.
   */
  observeDirectory(arg, callback) {
    if (typeof callback !== 'function')
      throw new Error('Expected callback function.');

    let node;

    if (typeof arg === 'object') {
      node = arg;

      if (node !== this._nodes.get(node.key))
        throw new TypeError('Node does not belong to this device.');
    } else if (typeof args === 'string') {
      node = getNodeByPath(arg);

      if (!node) throw new Error('Unknown node.');
    } else {
      throw new TypeError('Expected Node or string.');
    }

    if (!(node instanceof InternalNode)) throw new TypeError('Expected node.');

    const directoryObservers = this._directoryObservers;

    let observers = directoryObservers.get(node);

    if (!observers) {
      directoryObservers.set(node, (observers = new Set()));
      this._triggerGetDirectory(node.numericPath);
    }

    observers.add(callback);

    if (node.childrenReceived) {
      try {
        callback(node);
      } catch (err) {
        console.error(err);
      }
    }

    return () => {
      if (node === null) return;

      // The node was removed.
      if (this._nodes.get(node.key) !== node) return;
      observers.delete(callback);

      if (!observers.size) {
        directoryObservers.delete(node);
      }

      node = null;
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
