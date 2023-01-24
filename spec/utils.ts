import { join } from "path";
import { createParserFromTsconfig } from "../src/createParser";
import { ParseProject } from "../src/parse";

export function createParser(relativeTsConfigPath: string): ParseProject {
    return createParserFromTsconfig(join(__dirname, "project-test", relativeTsConfigPath));
}
