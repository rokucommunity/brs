import {
    ValueKind,
    BrsInvalid,
    BrsBoolean,
    BrsString,
    Uninitialized,
    BrsValue,
    Comparable,
} from "./BrsType";
import { RoArray } from "./components/RoArray";
import { RoList } from "./components/RoList";
import { RoByteArray } from "./components/RoByteArray";
import { RoAssociativeArray } from "./components/RoAssociativeArray";
import { Int32 } from "./Int32";
import { Int64 } from "./Int64";
import { Float } from "./Float";
import { Double } from "./Double";
import { Callable } from "./Callable";
import { BrsComponent } from "./components/BrsComponent";
import { RoString } from "./components/RoString";
import { BrsInterface } from "./BrsInterface";
import { RoPath } from "./components/RoPath";
import { roDouble } from "./components/RoDouble";
import { roFloat } from "./components/RoFloat";
import { roInt } from "./components/RoInt";
import { roLongInteger } from "./components/RoLongInteger";
import { RoDeviceInfoEvent } from "./components/RoDeviceInfoEvent";
import { RoSGNodeEvent } from "./components/RoSGNodeEvent";
import { RoSGScreenEvent } from "./components/RoSGScreenEvent";

export * from "./BrsType";
export * from "./Int32";
export * from "./Int64";
export * from "./Float";
export * from "./Double";
export * from "./BrsInterface";
export * from "./Callable";
export * from "./components/BrsComponent";
export * from "./components/RoDeviceInfo";
export * from "./components/RoArray";
export * from "./components/RoList";
export * from "./components/RoByteArray";
export * from "./components/RoDateTime";
export * from "./components/RoAssociativeArray";
export * from "./components/RoTimespan";
export * from "./components/BrsObjects";
export * from "./components/RoRegex";
export * from "./components/RoXMLElement";
export * from "./components/RoString";
export * from "./components/RoBoolean";
export * from "./components/RoDouble";
export * from "./components/RoFloat";
export * from "./components/RoInt";
export * from "./components/RoLongInteger";
export * from "./components/RoInvalid";
export * from "./components/RoSGNodeEvent";
export * from "./components/RoSGNode";
export * from "./components/RoMessagePort";
export * from "./components/RoAppInfo";
export * from "./components/RoPath";
export * from "./nodes/NodeFactory";
export * from "./nodes/Group";
export * from "./nodes/Scene";
export * from "./nodes/MiniKeyboard";
export * from "./nodes/TextEditBox";
export * from "./nodes/LayoutGroup";
export * from "./nodes/Rectangle";
export * from "./nodes/Label";
export * from "./nodes/Font";
export * from "./nodes/Poster";
export * from "./nodes/ArrayGrid";
export * from "./nodes/MarkupGrid";
export * from "./nodes/ContentNode";
export * from "./nodes/Timer";
export * from "./Boxing";
export * from "./Coercion";

/**
 * Determines whether or not the given value is a number.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` is a numeric value, otherwise `false`.
 */
export function isBrsNumber(value: BrsType): value is BrsNumber {
    return NumberKinds.has(value?.kind);
}

export function isNumberKind(kind: ValueKind): boolean {
    return NumberKinds.has(kind);
}

export const NumberKinds = new Set([
    ValueKind.Int32,
    ValueKind.Float,
    ValueKind.Double,
    ValueKind.Int64,
]);

export const PrimitiveKinds = new Set([
    ValueKind.Uninitialized,
    ValueKind.Invalid,
    ValueKind.Boolean,
    ...NumberKinds,
    ValueKind.String,
]);

/**
 * Determines whether or not the given value is a string.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` is a string, otherwise `false`.
 */
export function isBrsString(value: BrsType): value is BrsString {
    return value?.kind === ValueKind.String || value instanceof RoString;
}

/**
 * Determines whether or not the given value is a boolean.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` if a boolean, otherwise `false`.
 */
export function isBrsBoolean(value: BrsType): value is BrsBoolean {
    return value?.kind === ValueKind.Boolean;
}

/**
 * Determines whether or not the given value is a BrightScript callable.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` is a Callable value, otherwise `false`.
 */
export function isBrsCallable(value: BrsType): value is Callable {
    return value?.kind === ValueKind.Callable;
}

/**
 * Determines whether or not the provided value is an instance of a iterable BrightScript type.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` can be iterated across, otherwise `false`.
 */
export function isIterable(value: BrsType): value is Iterable {
    return "get" in value && "getElements" in value && "set" in value;
}

/**
 * Determines whether or not the given value can be compared as a string.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` can be compared as a string, otherwise `false`.
 */
export function isStringComp(value: BrsType): value is BrsString & Comparable {
    return isBrsString(value) || value instanceof RoPath;
}

/** Determines whether or not the given value is a BrightScript boxed number.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` is a boxed number, otherwise `false`.
 */
export function isBoxedNumber(value: BrsType): value is BoxedNumber {
    return (
        value instanceof roInt ||
        value instanceof roFloat ||
        value instanceof roDouble ||
        value instanceof roLongInteger
    );
}

/** The set of BrightScript numeric types. */
export type BrsNumber = Int32 | Int64 | Float | Double;

/** The set of BrightScript boxed numeric types. */
export type BoxedNumber = roInt | roFloat | roDouble | roLongInteger;

/**
 * Determines whether or not the given value is a BrightScript event component.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` is a BrightScript event component, otherwise `false`.
 */
export function isBrsEvent(value: BrsType): value is BrsEvent {
    return (
        value instanceof RoDeviceInfoEvent ||
        value instanceof RoSGNodeEvent ||
        value instanceof RoSGScreenEvent
    );
}

// The set of BrightScript Event components
export type BrsEvent =
    | RoDeviceInfoEvent
    | RoSGNodeEvent
    | RoSGScreenEvent;


/**
 * The set of all comparable BrightScript types. Only primitive (i.e. intrinsic * and unboxed)
 * BrightScript types are comparable to each other.
 */
export type BrsPrimitive = BrsInterface | BrsInvalid | BrsBoolean | BrsString | BrsNumber;

/** The set of BrightScript iterable types. */
export type Iterable = RoArray | RoList | RoAssociativeArray | RoByteArray;

// this is getting weird - we need a lesThan and greaterThan function?!
export type AllComponents = { kind: ValueKind.Object } & BrsComponent & BrsValue;

/** The set of all supported types in BrightScript. */
export type BrsType = BrsPrimitive | Iterable | Callable | AllComponents | Uninitialized;

// Function to check if the value is a BrightScript Type
export function isBrsType(value: any): value is BrsType {
    return (
        isBrsBoolean(value) ||
        isBrsString(value) ||
        isBrsNumber(value) ||
        value === BrsInvalid.Instance ||
        value instanceof BrsComponent ||
        value instanceof Callable ||
        value instanceof Uninitialized
    );
}

/** The valid ISO Date formats for roDateTime and roTimeSpan parsing */
export const ValidDateFormats = [
    "YYYY-MM-DDTHH:mm:ss.SSS[Z]",
    "YYYY-MM-DDTHH:mm:ss.SSS",
    "YYYY-MM-DDTHH:mm:ss[Z]",
    "YYYY-MM-DDTHH:mm:ss",
    "YYYY-MM-DDTHH:mm[Z]",
    "YYYY-MM-DDTHH:mm",
    "YYYY-MM-DDTHH[Z]",
    "YYYY-MM-DDTHH",
    "YYYY-MM-DDT",
    "YYYY-MM-DD[Z]",
    "YYYY-MM-DD",
    "YYYY-MM[Z]",
    "YYYY-MM",
    "YYYY[Z]",
    "YYYY",
];

/**
 * Converts a JavaScript object or Map to a RoAssociativeArray, converting each property or entry to the corresponding BrightScript type.
 * @param input The JavaScript object or Map to convert.
 * @returns A RoAssociativeArray with the converted properties or entries.
 */
export function toAssociativeArray(input: any): RoAssociativeArray {
    const associativeArray = new RoAssociativeArray([]);
    if (input instanceof Map) {
        input.forEach((value, key) => {
            let brsKey: BrsString;
            if (typeof key === "string") {
                brsKey = new BrsString(key);
            } else {
                throw new Error(`Unsupported key type: ${typeof key}`);
            }
            associativeArray.set(brsKey, brsValueOf(value), true);
        });
    } else if (typeof input === "object" && input !== null) {
        for (const key in input) {
            if (input.hasOwnProperty(key)) {
                const brsKey = new BrsString(key);
                associativeArray.set(brsKey, brsValueOf(input[key]), true);
            }
        }
    } else {
        throw new Error(`Unsupported input type: ${typeof input}`);
    }
    return associativeArray;
}

/**
 * Converts a value to its representation as a BrsType. If no such
 * representation is possible, throws an Error.
 * @param {any} x Some value.
 * @return {BrsType} The BrsType representation of `x`.
 * @throws {Error} If `x` cannot be represented as a BrsType.
 */
export function brsValueOf(x: any): BrsType {
    if (x === null || x === undefined || Number.isNaN(x)) {
        return BrsInvalid.Instance;
    }
    const maxInt = 0x80000000;
    const t: string = typeof x;
    switch (t) {
        case "boolean":
            return BrsBoolean.from(x);
        case "string":
            return new BrsString(x);
        case "number":
            if (Number.isInteger(x)) {
                return x >= -maxInt && x < maxInt ? new Int32(x) : new Int64(x);
            }
            return x >= -3.4e38 && x <= 3.4e38 ? new Float(x) : new Double(x);
        case "object":
            if (isBrsType(x)) {
                return x;
            } else if (Array.isArray(x)) {
                return new RoArray(x.map(brsValueOf));
            }
            return toAssociativeArray(x);
        default:
            throw new Error(`brsValueOf not implemented for: ${x} <${t}>`);
    }
}
