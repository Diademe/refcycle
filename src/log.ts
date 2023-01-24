import { stderr, stdout } from "process";

const enableDebug = false;
export function debug(message: string): void {
    if (enableDebug) {
        stdout.write(message);
    }
}

export function info(message: string): void {
    stdout.write(message);
}

export function error(message: string): void {
    stderr.write(message);
}
