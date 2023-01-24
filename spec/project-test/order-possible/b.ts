import { A } from "./a";

export class B
{
    public test(): string {
        return new A().test();
    }
}
