import { ParseProject } from "./parse";
import { getCommandLineOption } from "./commandLineOption";


export function createParserFromTsconfig(tsconfigPath: string): ParseProject {
    const commandLineOption = getCommandLineOption(tsconfigPath);
    return new ParseProject(commandLineOption.fileNames, commandLineOption.options);
}
