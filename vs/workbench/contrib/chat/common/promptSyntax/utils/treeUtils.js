/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { assert } from '../../../../../../base/common/assert.js';
/**
 * Flatter a tree structure into a single flat array.
 */
export function flatten(treeRoot) {
    const result = [];
    result.push(treeRoot);
    for (const child of treeRoot.children ?? []) {
        result.push(...flatten(child));
    }
    return result;
}
/**
 * Traverse a tree structure and execute a callback for each node.
 */
export function forEach(callback, treeRoot) {
    const shouldStop = callback(treeRoot);
    if (shouldStop === true) {
        return true;
    }
    for (const child of treeRoot.children ?? []) {
        const childShouldStop = forEach(callback, child);
        if (childShouldStop === true) {
            return true;
        }
    }
    return false;
}
/**
 * Maps nodes of a tree to a new type preserving the original tree structure by invoking
 * the provided callback function for each node.
 *
 * @param callback Function to map each of the nodes in the tree. The callback receives the original
 *                 readonly tree node and a list of its already-mapped readonly children and expected
 *                 to return a new tree node object. If the new object does not have an explicit
 *                 `children` property set (e.g., set to `undefined` or an array), the utility will
 *                 automatically set the `children` property to the `new mapped children` for you,
 *                 otherwise the set `children` property is preserved. Likewise, if the callback
 *                 modifies the `newChildren` array directly, but doesn't explicitly set the `children`
 *                 property on the returned object, the modification to the `newChildren` array are
 *                 preserved in the resulting object.
 *
 * @param treeRoot The root node of the tree to be mapped.
 *
 * ### Examples
 *
 * ```typescript
 * const tree = {
 *   id: '1',
 *   children: [
 *     { id: '1.1' },
 *     { id: '1.2' },
 * };
 *
 * const newTree = map((node, _newChildren) => {
 *   return {
 *     name: `name-of-${node.id}`,
 *   };
 * }, tree);
 *
 * assert.deepStrictEqual(newTree, {
 *   name: 'name-of-1',
 *   children: [
 *     { name: 'name-of-1.1' },
 *     { name: 'name-of-1.2' },
 * });
 * ```
 */
export function map(callback, treeRoot) {
    // if the node does not have children, just call the callback
    if (treeRoot.children === undefined) {
        return callback(treeRoot, undefined);
    }
    // otherwise process all the children recursively first
    const newChildren = treeRoot.children
        .map(curry(map, callback));
    // then run the callback with the new children
    const newNode = callback(treeRoot, newChildren);
    // if user explicitly set the children, preserve the value
    if ('children' in newNode) {
        return newNode;
    }
    // otherwise if no children is explicitly set,
    // use the new children array instead
    newNode.children = newChildren;
    return newNode;
}
/**
 * Utility to find a difference between two provided trees
 * of the same type. The result is another tree of difference
 * nodes that represent difference between tree node pairs.
 */
export function difference(tree1, tree2) {
    const tree1Children = tree1.children ?? [];
    const tree2Children = tree2.children ?? [];
    // if there are no children in the both trees left anymore,
    // compare the nodes directly themselves and return the result
    if (tree1Children.length === 0 && tree2Children.length === 0) {
        if (tree1.equals(tree2)) {
            return null;
        }
        return {
            index: 0,
            object1: tree1,
            object2: tree2,
        };
    }
    // with children present, iterate over them to find difference for each pair
    const maxChildren = Math.max(tree1Children.length, tree2Children.length);
    const children = [];
    for (let i = 0; i < maxChildren; i++) {
        const child1 = tree1Children[i];
        const child2 = tree2Children[i];
        // sanity check to ensure that at least one of the children is defined
        // as otherwise this case most likely indicates a logic error or a bug
        assert((child1 !== undefined) || (child2 !== undefined), 'At least one of the children must be defined.');
        // if one of the children is missing, report it as a difference
        if ((child1 === undefined) || (child2 === undefined)) {
            children.push({
                index: i,
                object1: child1 ?? null,
                object2: child2 ?? null,
            });
            continue;
        }
        const diff = difference(child1, child2);
        if (diff === null) {
            continue;
        }
        children.push({
            ...diff,
            index: i,
        });
    }
    // if there some children that are different, report them
    if (children.length !== 0) {
        return {
            index: 0,
            object1: tree1,
            object2: tree2,
            children,
        };
    }
    // there is no children difference, nor differences in the nodes
    // themselves, hence return explicit `null` value to indicate that
    return null;
}
/**
 * Curry a provided function with the first argument.
 */
export function curry(callback, arg1) {
    return (...args) => {
        return callback(arg1, ...args);
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJlZVV0aWxzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9oYXJtb255L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9wcm9tcHRTeW50YXgvdXRpbHMvdHJlZVV0aWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQU9qRTs7R0FFRztBQUNILE1BQU0sVUFBVSxPQUFPLENBQVksUUFBMEI7SUFDNUQsTUFBTSxNQUFNLEdBQWdCLEVBQUUsQ0FBQztJQUUvQixNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBRXRCLEtBQUssTUFBTSxLQUFLLElBQUksUUFBUSxDQUFDLFFBQVEsSUFBSSxFQUFFLEVBQUUsQ0FBQztRQUM3QyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFDaEMsQ0FBQztJQUVELE9BQU8sTUFBTSxDQUFDO0FBQ2YsQ0FBQztBQUVEOztHQUVHO0FBQ0gsTUFBTSxVQUFVLE9BQU8sQ0FBWSxRQUFzQyxFQUFFLFFBQTBCO0lBQ3BHLE1BQU0sVUFBVSxHQUFHLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUV0QyxJQUFJLFVBQVUsS0FBSyxJQUFJLEVBQUUsQ0FBQztRQUN6QixPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFFRCxLQUFLLE1BQU0sS0FBSyxJQUFJLFFBQVEsQ0FBQyxRQUFRLElBQUksRUFBRSxFQUFFLENBQUM7UUFDN0MsTUFBTSxlQUFlLEdBQUcsT0FBTyxDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUVqRCxJQUFJLGVBQWUsS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUM5QixPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7SUFDRixDQUFDO0lBRUQsT0FBTyxLQUFLLENBQUM7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