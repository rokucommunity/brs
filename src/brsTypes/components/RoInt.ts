import { BrsComponent } from "./BrsComponent";
import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid } from "../BrsType";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { BrsType, isBrsNumber } from "..";
import { Unboxable } from "../Boxing";
import { Int32 } from "../Int32";

export class roInt extends BrsComponent implements BrsValue, Unboxable {
    readonly kind = ValueKind.Object;
    private intrinsic: Int32;

    public getValue(): number {
        return this.intrinsic.getValue();
    }

    constructor(initialValue: Int32) {
        super("roInt");
        this.intrinsic = new Int32(isBrsNumber(initialValue) ? initialValue.getValue() : 0);
        this.registerMethods({
            ifInt: [this.getInt, this.setInt],
            // Per https://developer.roku.com/docs/references/brightscript/interfaces/ifintops.md,
            // ifIntOps _also_ implements toStr()
            ifIntOps: [this.toStr],
            ifToStr: [this.toStr],
        });
    }

    unbox() {
        return this.intrinsic;
    }

    equalTo(other: BrsType): BrsBoolean {
        if (other instanceof roInt) {
            return BrsBoolean.from(other.intrinsic.getValue() === this.intrinsic.getValue());
        }

        return BrsBoolean.False;
    }

    toString(_parent?: BrsType): string {
        return this.intrinsic.toString();
    }

    // ---------- ifInt ----------

    private getInt = new Callable("getInt", {
        signature: {
            args: [],
            returns: ValueKind.Double,
        },
        impl: (interpreter: Interpreter) => {
            return this.intrinsic;
        },
    });

    private setInt = new Callable("setInt", {
        signature: {
            args: [new StdlibArgument("value", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_interpreter, value: Int32) => {
            this.intrinsic = value;
            return BrsInvalid.Instance;
        },
    });

    // ---------- ifIntOps, ifToStr ----------

    private toStr = new Callable("toStr", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(this.intrinsic.toString());
        },
    });
}
