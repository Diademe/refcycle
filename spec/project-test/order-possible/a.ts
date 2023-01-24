import { B } from "./b";

export class A
{
    public static hardDep = B;

    public test(): string
    {
        return "test";
    }
}
