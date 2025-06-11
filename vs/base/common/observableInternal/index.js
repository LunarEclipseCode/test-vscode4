/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// This is a facade for the observable implementation. Only import from here!
export { observableValueOpts } from './observables/observableValueOpts.js';
export { autorun, autorunDelta, autorunHandleChanges, autorunOpts, autorunWithStore, autorunWithStoreHandleChanges, autorunIterableDelta } from './reactions/autorun.js';
export { disposableObservableValue } from './observables/observableValue.js';
export { derived, derivedDisposable, derivedHandleChanges, derivedOpts, derivedWithSetter, derivedWithStore } from './observables/derived.js';
export { ObservableLazy, ObservableLazyPromise, ObservablePromise, PromiseResult, } from './utils/promise.js';
export { derivedWithCancellationToken, waitForState } from './utils/utilsCancellation.js';
export { debouncedObservableDeprecated, debouncedObservable, derivedObservableWithCache, derivedObservableWithWritableCache, keepObserved, mapObservableArrayCached, observableFromPromise, recomputeInitiallyAndOnChange, signalFromObservable, wasEventTriggeredRecently, } from './utils/utils.js';
export { recordChanges } from './changeTracker.js';
export { constObservable } from './observables/constObservable.js';
export { observableSignal } from './observables/observableSignal.js';
export { observableFromEventOpts } from './observables/observableFromEvent.js';
export { observableSignalFromEvent } from './observables/observableSignalFromEvent.js';
export { asyncTransaction, globalTransaction, subtransaction, transaction, TransactionImpl } from './transaction.js';
export { observableFromValueWithChangeEvent, ValueWithChangeEventFromObservable } from './utils/valueWithChangeEvent.js';
export { runOnChange, runOnChangeWithCancellationToken, runOnChangeWithStore } from './utils/runOnChange.js';
export { derivedConstOnceDefined, latestChangedValue } from './experimental/utils.js';
export { observableFromEvent } from './observables/observableFromEvent.js';
export { observableValue } from './observables/observableValue.js';
export { ObservableSet } from './set.js';
export { ObservableMap } from './map.js';
import { addLogger, setLogObservableFn } from './logging/logging.js';
import { ConsoleObservableLogger, logObservableToConsole } from './logging/consoleObservableLogger.js';
import { DevToolsLogger } from './logging/debugger/devToolsLogger.js';
import { env } from '../process.js';
setLogObservableFn(logObservableToConsole);
// Remove "//" in the next line to enable logging
const enableLogging = false;
if (enableLogging) {
    addLogger(new ConsoleObservableLogger());
}
if (env && env['VSCODE_DEV_DEBUG']) {
    // To debug observables you also need the extension "ms-vscode.debug-value-editor"
    addLogger(DevToolsLogger.getInstance());
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2Jhc2UvY29tbW9uL29ic2VydmFibGVJbnRlcm5hbC9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyw2RUFBNkU7QUFFN0UsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDM0UsT0FBTyxFQUFFLE9BQU8sRUFBRSxZQUFZLEVBQUUsb0JBQW9CLEVBQUUsV0FBVyxFQUFFLGdCQUFnQixFQUFFLDZCQUE2QixFQUFFLG9CQUFvQixFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFFekssT0FBTyxFQUFFLHlCQUF5QixFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDN0UsT0FBTyxFQUFFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxvQkFBb0IsRUFBRSxXQUFXLEVBQUUsaUJBQWlCLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUU5SSxPQUFPLEVBQUUsY0FBYyxFQUFFLHFCQUFxQixFQUFFLGlCQUFpQixFQUFFLGFBQWEsR0FBRyxNQUFNLG9CQUFvQixDQUFDO0FBQzlHLE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxZQUFZLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUMxRixPQUFPLEVBQ04sNkJBQTZCLEVBQUUsbUJBQW1CLEVBQUUsMEJBQTBCLEVBQzlFLGtDQUFrQyxFQUFFLFlBQVksRUFBRSx3QkFBd0IsRUFBRSxxQkFBcUIsRUFDakcsNkJBQTZCLEVBQzdCLG9CQUFvQixFQUFFLHlCQUF5QixHQUMvQyxNQUFNLGtCQUFrQixDQUFDO0FBRTFCLE9BQU8sRUFBNEMsYUFBYSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDN0YsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ25FLE9BQU8sRUFBMEIsZ0JBQWdCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUM3RixPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUMvRSxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUN2RixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsaUJBQWlCLEVBQUUsY0FBYyxFQUFFLFdBQVcsRUFBRSxlQUFlLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUNySCxPQUFPLEVBQUUsa0NBQWtDLEVBQUUsa0NBQWtDLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUN6SCxPQUFPLEVBQUUsV0FBVyxFQUFFLGdDQUFnQyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDN0csT0FBTyxFQUFFLHVCQUF1QixFQUFFLGtCQUFrQixFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDdEYsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDM0UsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBRW5FLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFDekMsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUV6QyxPQUFPLEVBQUUsU0FBUyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFDckUsT0FBTyxFQUFFLHVCQUF1QixFQUFFLHNCQUFzQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDdkcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFHcEMsa0JBQWtCLENBQUMsc0JBQXNCLENBQUMsQ0FBQztBQUUzQyxpREFBaUQ7QUFDakQsTUFBTSxhQUFhLEdBQUcsS0FBSyxDQUV6QjtBQUVGLElBQUksYUFBYSxFQUFFLENBQUM7SUFDbkIsU0FBUyxDQUFDLElBQUksdUJBQXVCLEVBQUUsQ0FBQyxDQUFDO0FBQzFDLENBQUM7QUFFRCxJQUFJLEdBQUcsSUFBSSxHQUFHLENBQUMsa0JBQWtCLENBQUMsRUFBRSxDQUFDO0lBQ3BDLGtGQUFrRjtJQUNsRixTQUFTLENBQUMsY0FBYyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7QUFDekMsQ0FBQyJ9