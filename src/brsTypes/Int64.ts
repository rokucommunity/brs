import Long from "long";
import { BrsType, BrsBoolean, isNumberComp } from ".";
import { BrsNumber, Numeric } from "./BrsNumber";
import { ValueKind, Comparable } from "./BrsType";
import { Float } from "./Float";
import { Double } from "./Double";
import { Boxable } from "./Boxing";
import { roLongInteger } from "./components/RoLongInteger";

export class Int64 implements Numeric, Comparable, Boxable {
    readonly kind = ValueKind.Int64;
    private readonly value: Long;

    getValue(): Long {
        return this.value;
    }

    toBoolean(): boolean {
        return this.value.toNumber() !== 0;
    }

    /**
     * Creates a new BrightScript 64-bit integer value representing the provided `value`.
     * @param value the value to store in the BrightScript integer.
     */
    constructor(value: number | Long, public inArray: boolean = false) {
        if (value instanceof Long) {
            this.value = value;
        } else {
            this.value = Long.fromNumber(Math.trunc(value));
        }
    }

    /**
     * Creates a new BrightScript 64-bit integer value representing the integer contained in
     * `asString`.
     * @param asString the string representation of the value to store in the BrightScript 64-bit
     *                 int. Will be rounded to the nearest 64-bit integer.
     * @returns a BrightScript 64-bit integer value representing `asString`.
     */
    static fromString(asString: string): Int64 {
        let radix = 10;

        if (asString.toLowerCase().startsWith("&h")) {
            radix = 16; // it's a hex literal!
            asString = asString.slice(2).replace("&", ""); // remove "&h" from the start and tailing "&" if exists
        }

        let i64 = new Int64(Long.fromString(asString, undefined, radix));
        return i64;
    }

    add(rhs: BrsNumber): BrsNumber {
        switch (rhs.kind) {
            case ValueKind.Int32:
            case ValueKind.Int64:
                return new Int64(this.getValue().add(rhs.getValue()));
            case ValueKind.Float:
                return new Float(this.getValue().toNumber() + rhs.getValue());
            case ValueKind.Double:
                return new Double(this.getValue().toNumber() + rhs.getValue());
        }
    }

    subtract(rhs: BrsNumber): BrsNumber {
        switch (rhs.kind) {
            case ValueKind.Int32:
            case ValueKind.Int64:
                return new Int64(this.getValue().subtract(rhs.getValue()));
            case ValueKind.Float:
                return new Float(this.getValue().toNumber() - rhs.getValue());
            case ValueKind.Double:
                return new Double(this.getValue().toNumber() - rhs.getValue());
        }
    }

    multiply(rhs: BrsNumber): BrsNumber {
        switch (rhs.kind) {
            case ValueKind.Int32:
            case ValueKind.Int64:
                return new Int64(this.getValue().multiply(rhs.getValue()));
            case ValueKind.Float:
                return new Float(this.getValue().toNumber() * rhs.getValue());
            case ValueKind.Double:
                return new Double(this.getValue().toNumber() * rhs.getValue());
        }
    }

    divide(rhs: BrsNumber): Float | Double {
        switch (rhs.kind) {
            case ValueKind.Int32:
            case ValueKind.Int64:
                return new Float(this.getValue().divide(rhs.getValue()).toNumber());
            case ValueKind.Float:
                return new Float(this.getValue().toNumber() / rhs.getValue());
            case ValueKind.Double:
                return new Double(this.getValue().toNumber() / rhs.getValue());
        }
    }

    modulo(rhs: BrsNumber): Int64 {
        switch (rhs.kind) {
            case ValueKind.Int32:
            case ValueKind.Int64:
                return new Int64(this.getValue().modulo(rhs.getValue()));
            case ValueKind.Float:
                return new Int64(this.getValue().toNumber() % rhs.getValue());
            case ValueKind.Double:
                return new Int64(this.getValue().toNumber() % rhs.getValue());
        }
    }

    intDivide(rhs: BrsNumber): Int64 {
        switch (rhs.kind) {
            case ValueKind.Int32:
            case ValueKind.Int64:
                return new Int64(this.getValue().divide(rhs.getValue()));
            case ValueKind.Float:
            case ValueKind.Double:
                return new Int64(Math.floor(this.getValue().toNumber() / rhs.getValue()));
        }
    }

    leftShift(rhs: BrsNumber): Int64 {
        switch (rhs.kind) {
            case ValueKind.Int32:
            case ValueKind.Float:
            case ValueKind.Double:
                return new Int64(this.getValue().toNumber() << Math.trunc(rhs.getValue()));
            case ValueKind.Int64:
                return new Int64(this.getValue().toNumber() << rhs.getValue().toNumber());
        }
    }

    rightShift(rhs: BrsNumber): Int64 {
        switch (rhs.kind) {
            case ValueKind.Int32:
            case ValueKind.Float:
            case ValueKind.Double:
                return new Int64(this.getValue().toNumber() >> Math.trunc(rhs.getValue()));
            case ValueKind.Int64:
                return new Int64(this.getValue().toNumber() >> rhs.getValue().toNumber());
        }
    }

    pow(exponent: BrsNumber): BrsNumber {
        switch (exponent.kind) {
            case ValueKind.Int32:
                return new Int64(Math.pow(this.getValue().toNumber(), exponent.getValue()));
            case ValueKind.Float:
                return new Float(Math.pow(this.getValue().toNumber(), exponent.getValue()));
            case ValueKind.Double:
                return new Double(Math.pow(this.getValue().toNumber(), exponent.getValue()));
            case ValueKind.Int64:
                return new Int64(
                    Math.pow(this.getValue().toNumber(), exponent.getValue().toNumber())
                );
        }
    }

    and(rhs: BrsNumber | BrsBoolean): BrsNumber | BrsBoolean {
        if (rhs.kind === ValueKind.Boolean) {
            return BrsBoolean.from(this.toBoolean() && rhs.getValue());
        }
        return new Int64(this.getValue().and(rhs.getValue()));
    }

    or(rhs: BrsNumber | BrsBoolean): BrsNumber | BrsBoolean {
        if (rhs.kind === ValueKind.Boolean) {
            return BrsBoolean.from(this.toBoolean() || rhs.getValue());
        }
        return new Int64(this.getValue().or(rhs.getValue()));
    }

    not(): BrsNumber {
        return new Int64(this.getValue().not());
    }

    lessThan(other: BrsType): BrsBoolean {
        switch (other.kind) {
            case ValueKind.Int32:
            case ValueKind.Int64:
                return BrsBoolean.from(this.getValue().lessThan(other.getValue()));
            case ValueKind.Float:
                return new Float(this.getValue().toNumber()).lessThan(other);
            case ValueKind.Double:
                return new Double(this.getValue().toNumber()).lessThan(other);
        }
        if (isNumberComp(other)) {
            return BrsBoolean.from(this.getValue().lessThan(other.getValue()));
        }
        return BrsBoolean.False;
    }

    greaterThan(other: BrsType): BrsBoolean {
        switch (other.kind) {
            case ValueKind.Int32:
            case ValueKind.Int64:
                return BrsBoolean.from(this.getValue().greaterThan(other.getValue()));
            case ValueKind.Float:
                return new Float(this.getValue().toNumber()).greaterThan(other);
            case ValueKind.Double:
                return new Double(this.getValue().toNumber()).greaterThan(other);
        }
        if (isNumberComp(other)) {
            return BrsBoolean.from(this.getValue().greaterThan(other.getValue()));
        }
        return BrsBoolean.False;
    }

    equalTo(other: BrsType): BrsBoolean {
        switch (other.kind) {
            case ValueKind.Int32:
            case ValueKind.Int64:
                return BrsBoolean.from(this.getValue().equals(other.getValue()));
            case ValueKind.Float:
                return new Float(this.getValue().toNumber()).equalTo(other);
            case ValueKind.Double:
                return new Double(this.getValue().toNumber()).equalTo(other);
            case ValueKind.Boolean:
                return other.equalTo(BrsBoolean.from(this.toBoolean()));
        }
        if (isNumberComp(other)) {
            return BrsBoolean.from(this.getValue().equals(other.getValue()));
        }
        return BrsBoolean.False;
    }

    toString(parent?: BrsType): string {
        return Number.isNaN(this.value.toNumber()) ? "nan" : this.value.toString();
    }

    box() {
        return new roLongInteger(this);
    }
}
