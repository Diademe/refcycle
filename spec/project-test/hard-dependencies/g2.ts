import { G1 } from "./g1";
import { log } from "./class-decorator";
import { logPrefix } from "./member-decorator";
import { aString } from "./a-string";
import { anOtherString } from "./shouldNotBeImported";

@log
export class G2 extends G1 {
    @logPrefix(aString)
    public member: string;

    constructor() {
        super();
        this.member = anOtherString;
    }
    /**
     * the body of the function should not be accounted for (only root variables can be accounted for)
     */
    private method(): string {
        return anOtherString;
    }

    public get test(): string {
        return anOtherString;
    }
}

/**
 * the body of the function should not be accounted for (only root variables can be accounted for)
 */
export function toto() {
    const oneString = anOtherString;
}
