export function logPrefix (prefix: string) {
    return (...args: any[]): void => {
        console.log(prefix, ...args);
    };
}
