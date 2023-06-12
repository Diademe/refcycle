import ts from "typescript";
import { dirname } from "path";

const host: ts.ParseConfigHost = {
    useCaseSensitiveFileNames: true,
    fileExists: ts.sys.fileExists,
    readDirectory: ts.sys.readDirectory,
    readFile: ts.sys.readFile
};

export function getCommandLineOption(tsconfigPath: string): ts.ParsedCommandLine {
    const config: unknown = JSON.parse(ts.sys.readFile(tsconfigPath)!);
    return ts.parseJsonConfigFileContent(config, host, dirname(tsconfigPath));
}
