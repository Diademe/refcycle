export class Token<S> {
    constructor(
        public readonly name: string,
        public readonly isLibrary: boolean,
        public readonly isExcluded: boolean,
        public isUsed: boolean,
        public readonly declarationPath: string,
        public readonly symbol: S) { }

    public toString(): string {
        return `{name:${this.name}, isLibrary:${this.isLibrary.toString()}, isExcluded:${this.isExcluded.toString()}, declarationPath:${this.declarationPath}}`;
    }
}
