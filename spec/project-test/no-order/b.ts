import { A } from "./a";

export class B
{
    public static hardDep = A;

    public test(): string {
        return new A().test();
    }
}
