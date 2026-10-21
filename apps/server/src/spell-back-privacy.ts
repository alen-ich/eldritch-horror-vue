import type { SpellBackRecord } from "./private-spell-back-types.js";
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
export interface TextArtifact { path: string; text: string }

function normalize(text: string): string {
  return text.replace(/\\u\{([0-9a-f]+)\}|\\u([0-9a-f]{4})|\\x([0-9a-f]{2})/gi,
    (_, point, unit, byte) => String.fromCodePoint(parseInt(point ?? unit ?? byte, 16)))
    .replace(/\\[nrt]/g, " ").replace(/\\(["'\/\\])/g, "$1")
    .replace(/[‘’]/g, "'").replace(/\s+/g, " ").toLowerCase();
}

/** Targeted regression detector, not a general-purpose secret scanner. */
export function assertNoPrivateSpellBackData(artifacts: readonly TextArtifact[], backs: readonly SpellBackRecord[]): void {
  const needles = backs.flatMap(card => card.branches.flatMap(branch => branch.instructions.map(instruction => normalize(instruction.text).slice(0, 85))));
  for (const artifact of artifacts) {
    const text = normalize(artifact.text);
    const forbiddenStructure = /private-card-assets\/spells\/|private-spell-back(?:s|-types)|private-feed-the-mind|feedthemindbyphysicalid["']?\s*[:=]|["']?printednumber["']?\s*:|["']?physicalid["']?\s*:\s*["']spell_/;
    if (forbiddenStructure.test(text) || needles.some(needle => text.includes(needle))) {
      throw new Error(`Private Spell data in ${artifact.path}`);
    }
  }
}

/** Compiler-resolved traversal includes barrels, static dynamic imports and Vue scripts. */
export function assertPublicSpellImportBoundary(entries: readonly string[], root: string): void {
  const visited = new Set<string>();
  const options: ts.CompilerOptions = { module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, allowJs: true };
  function visit(input: string): void {
    if (!existsSync(input)) throw new Error(`Missing import-boundary input: ${input}`);
    const file = realpathSync(input);
    if (visited.has(file)) return; visited.add(file);
    if (/private-spell-back(?:s|-types)|private-feed-the-mind|spell-back-privacy/i.test(file)) throw new Error(`Private Spell import: ${file}`);
    if (statSync(file).isDirectory()) {
      for (const child of readdirSync(file)) visit(path.join(file, child));
      return;
    }
    if (!/\.(?:[cm]?[jt]sx?|vue)$/.test(file)) return;
    const raw = readFileSync(file, "utf8");
    const source = file.endsWith(".vue") ? [...raw.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]).join("\n") : raw;
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    function follow(specifier: string): void {
      if (/private-spell-back|private-feed-the-mind|spell-back-privacy/.test(specifier)) throw new Error(`Private Spell import: ${file}`);
      const alias = /^(?:~|@)\//.test(specifier) ? path.join(root, "apps/web/app", specifier.slice(2)) : specifier;
      let resolved = ts.resolveModuleName(alias, file, options, ts.sys).resolvedModule?.resolvedFileName;
      if (!resolved && (specifier.startsWith(".") || /^(?:~|@)\//.test(specifier))) {
        const absolute = specifier.startsWith(".") ? path.resolve(path.dirname(file), specifier) : alias;
        resolved = [absolute, `${absolute}.vue`, `${absolute}.ts`, path.join(absolute, "index.ts")].find(candidate => existsSync(candidate) && statSync(candidate).isFile());
        if (!resolved) throw new Error(`Unresolved local public import in ${file}: ${specifier}`);
      }
      if (resolved) {
        const target = realpathSync(resolved);
        const relative = path.relative(root, target);
        if (!relative.startsWith("..") && !relative.split(path.sep).includes("node_modules")) visit(target);
      }
    }
    function walk(node: ts.Node): void {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) follow(node.moduleSpecifier.text);
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === "require") && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) follow(node.arguments[0].text);
      ts.forEachChild(node, walk);
    }
    walk(ast);
  }
  for (const entry of entries) visit(entry);
}
