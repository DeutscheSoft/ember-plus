export const HAS_BIGINT = typeof BigInt !== 'undefined';
export const UINT64_MAX = HAS_BIGINT && (1n << 64n) - 1n;
export const INT64_MAX = HAS_BIGINT && UINT64_MAX >> 1n;
export const INT64_MIN = HAS_BIGINT && -INT64_MAX - 1n;
export const INT56_MAX = HAS_BIGINT && (1n << 55n) - 1n;
export const INT56_MIN = HAS_BIGINT && -INT56_MAX - 1n;
