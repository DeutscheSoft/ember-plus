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
} from '../ber.js';

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
const emberCommandType = Enum(
  ...new Array(30).concat(['subscribe', 'unsubscribe', 'getDirectory'])
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

export class emberParameterContents extends AnonymousStruct({
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
}) {}

export class emberElementCollection extends SequenceOf(4, null) {}

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
