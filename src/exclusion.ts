export const regex: { val: RegExp | null } = {
   val: null
};

export function exclusion(
    modulePath: string
): boolean
{
    return regex.val ? regex.val.test(modulePath) : false;
}
