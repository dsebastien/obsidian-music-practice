/** A translation table: exactly the keys of a source table, each with a string. */
export type Translation<Source> = { [K in keyof Source]: string }
