import { RoAssociativeArray, BrsString, mGlobal, toAssociativeArray } from "../brsTypes";
import { mockComponent } from "./mockComponent";
import { mockFunction } from "./mockFunction";
import { mockComponentPartial } from "./mockComponentPartial";
import { RunInScope } from "./RunInScope";
import { Process } from "./Process";
import {
    resetMocks,
    resetMockComponents,
    resetMockFunctions,
    resetMockComponent,
    resetMockFunction,
} from "./resetMocks";
import { triggerKeyEvent } from "./triggerKeyEvent";
import { GetStackTrace } from "./GetStackTrace";

export const _brs_ = toAssociativeArray({
    mockComponent: mockComponent,
    mockFunction: mockFunction,
    mockComponentPartial: mockComponentPartial,
    resetMocks: resetMocks,
    resetMockComponents: resetMockComponents,
    resetMockComponent: resetMockComponent,
    resetMockFunctions: resetMockFunctions,
    resetMockFunction: resetMockFunction,
    runInScope: RunInScope,
    process: Process,
    global: mGlobal,
    testData: new RoAssociativeArray([]),
    triggerKeyEvent: triggerKeyEvent,
    getStackTrace: GetStackTrace,
});

/** resets _brs_.testData values to `{}` in brightscript representation */
export function resetTestData() {
    _brs_.set(new BrsString("testData"), new RoAssociativeArray([]));
}
