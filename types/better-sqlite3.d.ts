declare module "better-sqlite3" {
  // better-sqlite3 ships native bindings without TypeScript declarations in this project.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Database: any;
  export default Database;
}
