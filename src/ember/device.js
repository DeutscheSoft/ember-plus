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

    this.nodes.set(parameter.key, parameter);
    this.nodesByPath.set(parameter.identifierPath, parameter);

    console.log('created parameter %o', parameter.identifierPath);
  }

  _createNode(parent, element) {
    const node = Node.from(parent, element);

    this.nodes.set(node.key, node);
    this.nodesByPath.set(node.identifierPath, node);

    console.log('created node %o', node.identifierPath);

    this.connection.sendGetDirectory(node.getQualifiedNode());

    return node;
  }

  _getParent(path) {
    let parent;

    if (path.length) {
      parent = this.nodes.get(path.join('.'));

      if (!parent) throw new Error('Could not find parent.');

      if (!(parent instanceof Node)) throw new Error('Expected Node parent.');
    } else {
      parent = null;
    }

    return parent;
  }

  _handleNodeElement(nodeElement, parentPath) {
    const path = parentPath.concat([nodeElement.number]);
    let node = this.nodes.get(path.join('.'));

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
    const node = this.nodes.get(path.join('.'));

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
    let parameter = this.nodes.get(path.join('.'));

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
    const parameter = this.nodes.get(path.join('.'));

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

  constructor(connection) {
    this.connection = connection;

    // contains all nodes by TreeNode.key
    this.nodes = new Map();

    // contains all nodes by TreeNode.identifierPath
    this.nodesByPath = new Map();

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
}
