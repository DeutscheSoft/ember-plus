import { S101FrameDecoder, S101EncodeFrame } from './s101.js';
import {
  AnonymousChoice,
  AnonymousStruct,
  Choice,
  Enum,
  SequenceOf,
  Struct,
  TLV,
  TYPE_BOOLEAN,
  TYPE_INTEGER,
  TYPE_REAL,
  TYPE_RELATIVE_OID,
  TYPE_OCTETSTRING,
  TYPE_UTF8STRING,
} from './ber.js';

const EMBER_ROOT = 0,
  EMBER_PARAMETER = 1,
  EMBER_COMMAND = 2,
  EMBER_NODE = 3,
  EMBER_ELEMENT_COLLECTION = 4,
  EMBER_STREAM_COLLECTION = 5,
  EMBER_STREAM_ENTRY = 6,
  EMBER_STRING_INTEGER_PAIR = 7,
  EMBER_STRING_INTEGER_COLLECTION = 8,
  EMBER_QUALIFIED_PARAMETER = 9,
  EMBER_QUALIFIED_NODE = 10,
  EMBER_ROOT_ELEMENT_COLLECTION = 11;

const emberValue = AnonymousChoice(
  TYPE_INTEGER,
  TYPE_REAL,
  TYPE_UTF8STRING,
  TYPE_BOOLEAN,
  TYPE_OCTETSTRING
);
const emberMinMax = AnonymousChoice(TYPE_INTEGER, TYPE_REAL);
const emberParameterType = Enum(
  'integer',
  'real',
  'string',
  'boolean',
  'trigger',
  'enum',
  'octets'
);
const emberParameterAccess = Enum('none', 'read', 'write', 'readWrite');
const emberStreamFormat = Enum(
  'unsignedInt8',
  void 0,
  'unsignedInt16BigEndian',
  'unsignedInt16LittleEndian',
  'unsignedInt32BigEndian',
  'unsignedInt32LittleEndian',
  'unsignedInt64BigEndian',
  'unsignedInt64LittleEndian',
  'signedInt8',
  void 0,
  'signedInt16BigEndian',
  'signedInt16LittleEndian',
  'signedInt32BigEndian',
  'signedInt32LittleEndian',
  'signedInt64BigEndian',
  'signedInt64LittleEndian',
  void 0,
  void 0,
  void 0,
  void 0,
  'ieeeFloat32BigEndian',
  'ieeeFloat32LittleEndian',
  'ieeeFloat64BigEndian',
  'ieeeFloat64LittleEndia'
);
const emberCommandType = Enum.apply(
  this,
  new Array(30).concat(['subscribe', 'unsubstribe', 'getDirectory'])
);

const emberNodeContents = AnonymousStruct({
  identifier: TYPE_UTF8STRING,
  description: TYPE_UTF8STRING,
  isRoot: TYPE_BOOLEAN,
  isOnline: TYPE_BOOLEAN, // FIXME: default = true
});

export class emberCommand extends Struct(2, {
  number: emberCommandType,
  options: TYPE_INTEGER,
}) {}

const emberStringIntegerPair = Struct(7, {
  entryString: TYPE_UTF8STRING,
  entryInteger: TYPE_INTEGER,
});

const emberStringIntegerCollection = SequenceOf(8, emberStringIntegerPair);

const emberStreamDescription = Struct(12, {
  format: emberStreamFormat,
  offset: TYPE_INTEGER,
});

const emberParameterContents = AnonymousStruct({
  identifier: TYPE_UTF8STRING,
  description: TYPE_UTF8STRING,
  value: emberValue,
  minimum: emberMinMax,
  maximum: emberMinMax,
  access: emberParameterAccess,
  format: TYPE_UTF8STRING,
  enumeration: TYPE_UTF8STRING,
  factor: TYPE_INTEGER,
  isOnline: TYPE_BOOLEAN,
  formula: TYPE_UTF8STRING,
  step: TYPE_INTEGER,
  default: emberValue,
  type: emberParameterType,
  streamIdentifier: TYPE_INTEGER,
  enumMap: emberStringIntegerCollection,
  streamDescriptor: emberStreamDescription,
});

class emberElementCollection extends SequenceOf(4, null) {}

export class emberParameter extends Struct(1, {
  number: TYPE_INTEGER,
  contents: emberParameterContents,
  children: emberElementCollection,
}) {}

export class emberQualifiedParameter extends Struct(9, {
  path: TYPE_RELATIVE_OID,
  contents: emberParameterContents,
  children: emberElementCollection,
}) {}

export class emberQualifiedNode extends Struct(10, {
  path: TYPE_RELATIVE_OID,
  contents: emberNodeContents,
  children: emberElementCollection,
}) {}

export class emberNode extends Struct(3, {
  number: TYPE_INTEGER,
  contents: emberNodeContents,
  children: emberElementCollection,
}) {}

const emberElement = AnonymousChoice(emberParameter, emberNode, emberCommand); // TODO: also matrix
emberElementCollection.setType(emberElement);

const emberRootElement = AnonymousChoice(
  emberParameter,
  emberNode,
  emberCommand,
  emberQualifiedParameter,
  emberQualifiedNode
); // TODO: also matrix
export const emberRootElementCollection = SequenceOf(11, emberRootElement);

const emberStreamEntry = Struct(5, {
  streamIdentifier: TYPE_INTEGER,
  streamValue: emberValue,
});

const emberStreamCollection = SequenceOf(6, emberStreamEntry);

export class emberRoot extends Choice(
  0,
  emberRootElementCollection,
  emberStreamCollection
) {}

function toQualifiedNode(node) {
  if (node instanceof emberQualifiedNode) {
    return emberQualifiedNode.from({
      path: node.path,
    });
  } else if (node instanceof emberNode) {
    return emberQualifiedNode.from({
      path: [node.number],
    });
  }
}

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

    if (parent !== null) path = parent.identifierPath + '/' + path;

    this._identifierPath = path;

    return path;
  }

  get key() {
    return this._key;
  }

  constructor(parent, number, identifier) {
    this._parent = parent || null;
    this._number = number;
    this._identifier = identifier;
    this._numericPath = null;
    this._identifierPath = null;
    this._key = this.numericPath.join('.');
  }
}

class Node extends TreeNode {
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

  constructor(parent, number, contents) {
    super(parent, number, contents.identifier);
    this._description = contents.description;
    this._isRoot = contents.isRoot;
    this._isOnline = contents.isOnline !== false;
  }

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

  updateFrom(contents) {
    for (let name in contents) {
      const value = contents[name];

      if (value !== void 0 && value !== this[name]) {
        this['_' + name] = value;
        // TODO: generate changed event
      }
    }
  }
}

class Parameter extends TreeNode {
  getQualifiedParameter() {
    return emberQualifiedParameter.from({
      path: this.numericPath,
    });
  }

  getSetValue() {
    return emberQualifiedParameter.from({
      path: this.numericPath,
    });
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

  updateFrom(contents) {
    for (let name in contents) {
      const value = contents[name];

      if (value !== void 0 && value !== this[name]) {
        this['_' + name] = value;
        // TODO: generate changed event
      }
    }
  }

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
}

/*
 * Connection handling.
 */

export class EmberConnection {
  constructor() {
    this.frame_decoder = new S101FrameDecoder();
    this.fragments = null;
    this.onRootElement = null;
  }

  send(buf) {
    this.write(S101EncodeFrame(buf));
  }

  sendKeepaliveRequest() {
    const u8 = Uint8Array.from([0, 0x0e, 0x01, 0x01]);

    this.send(u8.buffer);
  }

  sendKeepaliveResponse() {
    const u8 = Uint8Array.from([0, 0x0e, 0x02, 0x01]);

    this.send(u8.buffer);
  }

  sendEmber(tlv) {
    const buf = tlv.encode();
    const u8 = new Uint8Array(9 + buf.byteLength);
    u8.set([0, 0x0e, 0x00, 0x01, 0xc0, 0x01, 0x02, 31, 0x02], 0);
    u8.set(new Uint8Array(buf), 9);

    this.send(u8.buffer);
  }

  sendGetDirectory(node) {
    const list = [];
    const cmd = new emberCommand('getDirectory');

    if (node) {
      const qualifiedNode = toQualifiedNode(node);
      qualifiedNode.children = new emberElementCollection([cmd]);
      list.push(qualifiedNode);
    } else {
      list.push(cmd);
    }
    const collection = new emberRootElementCollection(list);
    const root = new emberRoot(collection);
    this.sendEmber(root.encode());
  }

  onMessage(data, pos) {
    try {
      while (pos < data.byteLength) {
        let tlv;
        [tlv, pos] = TLV.decode_from(data, pos);
        const root = emberRoot.decode(tlv);

        //console.log('Received message', root);

        root.value.list.forEach((element) => {
          if (this.onRootElement === null) {
            console.warn('Dropped root element %o', element);
          }

          try {
            this.onRootElement(element);
          } catch (error) {
            console.error(error);
          }
        });
      }
    } catch (error) {
      console.error('Error in onMessage', error);
    }
  }

  receive(buf) {
    this.frame_decoder.feed(buf);

    while (true) {
      let frame = this.frame_decoder.parse();

      if (frame === null) break;

      let pos = 0;
      const slot = frame.getUint8(pos++);
      const message = frame.getUint8(pos++);
      const command = frame.getUint8(pos++);
      const version = frame.getUint8(pos++);

      if (slot !== 0) throw new Error('Expected slot 0.');

      if (message !== 0x0e) throw new Error('Expected Ember message.');

      if (version !== 1) throw new Error('Unsupported Ember version.');

      if (command === 1) {
        this.sendKeepaliveResponse();
        continue;
      }

      if (command === 2) {
        // handle keepalive received.
        continue;
      }

      if (command !== 0) throw new Error('Unsupported command type.');

      const flags = frame.getUint8(pos++);
      const dtd = frame.getUint8(pos++);
      const app_bytes = frame.getUint8(pos++);

      if (app_bytes !== 2) throw new Error('Unexpected number of app bytes.');

      pos += app_bytes;

      switch (flags) {
        case 0x00: // multi-message packet
          if (!this.fragments) throw new Error('Have empty partition buffer.');
          this.fragments.push(
            new Uint8Array(
              frame.buffer,
              frame.byteOffset + pos,
              frame.byteLength - pos
            )
          );
          break;
        case 0x20: // empty packet
          break;
        case 0xc0:
          this.onMessage(frame, pos);
          break;
        case 0x80: // multi-packet message start
          if (this.fragments)
            throw new Error('Still have non-empty partition buffer.');
          this.fragments = [
            new Uint8Array(
              frame.buffer,
              frame.byteOffset + pos,
              frame.byteLength - pos
            ),
          ];
          break;
        case 0x40: {
          // multi-packet message end
          if (!this.fragments) throw new Error('Have empty partition buffer.');
          this.fragments.push(
            new Uint8Array(
              frame.buffer,
              frame.byteOffset + pos,
              frame.byteLength - pos
            )
          );

          let length = 0;
          const fragments = this.fragments;
          this.fragments = null;

          for (let i = 0; i < fragments.length; i++)
            length += fragments[i].byteLength;

          const out = new ArrayBuffer(length);
          const o8 = new Uint8Array(out);

          for (let i = 0, pos = 0; i < fragments.length; i++) {
            const fragment = fragments[i];
            o8.set(fragment, pos);
            pos += fragment.byteLength;
          }

          this.onMessage(new DataView(out), 0);
          break;
        }
        default:
          throw new Error('Unexpected flags value.');
      }
    }
  }

  teardown(err) {
    if (this.onerror) {
      try {
        this.onerror(err);
      } catch (e) {
        console.error(e);
      }
    }
    this.close();
  }

  close() {
    if (this.onclose) {
      try {
        this.onclose();
      } catch (e) {
        console.error(e);
      }
    }
  }
}

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
