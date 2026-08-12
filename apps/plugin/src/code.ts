/// <reference types="@figma/plugin-typings" />
import type { MirrorNode, SnapshotAsset, SnapshotManifest } from "@figma-mirror/shared";

const PLUGIN_VERSION = "0.1.0";
figma.showUI(__html__, { width: 340, height: 520, themeColors: true });

type ExportFile = { descriptor: SnapshotAsset; bytes: Uint8Array };
const postStatus = () => figma.ui.postMessage({ type: "context", file: figma.root.name, page: figma.currentPage.name, selection: figma.currentPage.selection.map((n) => n.name).join(", ") || "Nothing selected" });
figma.on("selectionchange", postStatus); postStatus();

const num = (value: number | PluginAPI["mixed"] | null | undefined) => typeof value === "number" ? value : undefined;
const color = (value: RGB | RGBA) => { const a = "a" in value ? value.a : 1; const channel = (n: number) => Math.round(n * 255); return { r: value.r, g: value.g, b: value.b, a, hex: `#${[channel(value.r), channel(value.g), channel(value.b), channel(a)].map((n) => n.toString(16).padStart(2, "0")).join("").toUpperCase()}` }; };
const clean = <T>(value: T): T => JSON.parse(JSON.stringify(value, (_key, item) => item === undefined || typeof item === "symbol" ? undefined : item));

function paints(values: readonly Paint[] | PluginAPI["mixed"], variableNames: Map<string, string>) {
  if (values === figma.mixed) return { mixed: true };
  return values.map((paint) => clean({ type: paint.type, visible: paint.visible, opacity: paint.opacity, blendMode: paint.blendMode,
    ...(paint.type === "SOLID" ? { color: color({ ...paint.color, a: paint.opacity ?? 1 }), variable: paint.boundVariables?.color ? variableNames.get(paint.boundVariables.color.id) : undefined } : {}),
    ...("gradientStops" in paint ? { gradientStops: paint.gradientStops.map((stop) => ({ position: stop.position, color: color(stop.color) })), gradientTransform: paint.gradientTransform } : {}),
    ...(paint.type === "IMAGE" ? { imageHash: paint.imageHash, scaleMode: paint.scaleMode, imageTransform: paint.imageTransform, filters: paint.filters } : {}) }));
}

function effects(values: readonly Effect[] | PluginAPI["mixed"]) {
  if (values === figma.mixed) return { mixed: true };
  return values.map((effect) => clean({ type: effect.type, visible: effect.visible, blendMode: "blendMode" in effect ? effect.blendMode : undefined, radius: "radius" in effect ? effect.radius : undefined,
    ...(effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW" ? { color: color(effect.color), offset: effect.offset, spread: effect.spread } : {}) }));
}

async function serialize(root: SceneNode, variableNames: Map<string, string>, includeHidden: boolean) {
  const result: MirrorNode[] = []; const warnings: string[] = []; const files: ExportFile[] = []; const seenImages = new Set<string>();
  async function visit(node: SceneNode, parentId: string | null, names: string[], depth: number): Promise<void> {
    if (!includeHidden && !node.visible) return;
    const path = [...names, node.name].join(" / "); const data: Record<string, unknown> = {};
    const box = node.absoluteBoundingBox; Object.assign(data, { absoluteBoundingBox: box, constraints: "constraints" in node ? node.constraints : undefined, blendMode: "blendMode" in node ? node.blendMode : undefined, isMask: "isMask" in node ? node.isMask : undefined, maskType: "maskType" in node ? node.maskType : undefined, boundVariables: clean(node.boundVariables ?? {}) });
    if ("layoutMode" in node) Object.assign(data, clean({ layoutMode: node.layoutMode, layoutWrap: node.layoutWrap, primaryAxisSizingMode: node.primaryAxisSizingMode, counterAxisSizingMode: node.counterAxisSizingMode, primaryAxisAlignItems: node.primaryAxisAlignItems, counterAxisAlignItems: node.counterAxisAlignItems, counterAxisAlignContent: node.counterAxisAlignContent, paddingTop: node.paddingTop, paddingRight: node.paddingRight, paddingBottom: node.paddingBottom, paddingLeft: node.paddingLeft, itemSpacing: node.itemSpacing, counterAxisSpacing: node.counterAxisSpacing, itemReverseZIndex: node.itemReverseZIndex, strokesIncludedInLayout: node.strokesIncludedInLayout, clipsContent: node.clipsContent }));
    if ("layoutGrow" in node) Object.assign(data, clean({ layoutGrow: node.layoutGrow, layoutAlign: node.layoutAlign, layoutPositioning: node.layoutPositioning, minWidth: node.minWidth, maxWidth: node.maxWidth, minHeight: node.minHeight, maxHeight: node.maxHeight }));
    if ("fills" in node) data.fills = paints(node.fills, variableNames);
    if ("strokes" in node) Object.assign(data, clean({ strokes: paints(node.strokes, variableNames), strokeWeight: num(node.strokeWeight), strokeTopWeight: "strokeTopWeight" in node ? num(node.strokeTopWeight) : undefined, strokeRightWeight: "strokeRightWeight" in node ? num(node.strokeRightWeight) : undefined, strokeBottomWeight: "strokeBottomWeight" in node ? num(node.strokeBottomWeight) : undefined, strokeLeftWeight: "strokeLeftWeight" in node ? num(node.strokeLeftWeight) : undefined, strokeAlign: node.strokeAlign, dashPattern: node.dashPattern }));
    if ("effects" in node) data.effects = effects(node.effects);
    if ("cornerRadius" in node) Object.assign(data, clean({ cornerRadius: num(node.cornerRadius), topLeftRadius: "topLeftRadius" in node ? num(node.topLeftRadius) : undefined, topRightRadius: "topRightRadius" in node ? num(node.topRightRadius) : undefined, bottomRightRadius: "bottomRightRadius" in node ? num(node.bottomRightRadius) : undefined, bottomLeftRadius: "bottomLeftRadius" in node ? num(node.bottomLeftRadius) : undefined }));
    if (node.type === "TEXT") {
      Object.assign(data, clean({ characters: node.characters, fontName: node.fontName === figma.mixed ? { mixed: true } : node.fontName, fontSize: num(node.fontSize), fontWeight: num(node.fontWeight), lineHeight: node.lineHeight === figma.mixed ? { mixed: true } : node.lineHeight, letterSpacing: node.letterSpacing === figma.mixed ? { mixed: true } : node.letterSpacing, textAlignHorizontal: node.textAlignHorizontal, textAlignVertical: node.textAlignVertical, textCase: node.textCase === figma.mixed ? "MIXED" : node.textCase, textDecoration: node.textDecoration === figma.mixed ? "MIXED" : node.textDecoration, paragraphSpacing: node.paragraphSpacing, paragraphIndent: node.paragraphIndent,
        runs: node.getStyledTextSegments(["fontName", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "textCase", "textDecoration", "fills", "textStyleId", "fillStyleId"]).map((run) => ({ start: run.start, end: run.end, text: run.characters, style: { fontName: run.fontName, fontSize: run.fontSize, fontWeight: run.fontWeight, lineHeight: run.lineHeight, letterSpacing: run.letterSpacing, textCase: run.textCase, textDecoration: run.textDecoration, fills: paints(run.fills, variableNames), textStyleId: run.textStyleId, fillStyleId: run.fillStyleId } })) }));
    }
    if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") Object.assign(data, { componentName: node.name, componentProperties: clean(node.componentPropertyDefinitions), variantProperties: node.type === "COMPONENT" ? clean(node.variantProperties) : undefined });
    if (node.type === "INSTANCE") { const main = await node.getMainComponentAsync(); Object.assign(data, { componentName: main?.name, mainComponentId: main?.id, componentProperties: clean(node.componentProperties), variantProperties: clean(node.variantProperties) }); }
    const children = "children" in node ? node.children.filter((child): child is SceneNode => includeHidden || child.visible).map((child) => child.id) : [];
    result.push(clean({ id: node.id, parentId, name: node.name, type: node.type, path, depth, x: node.x, y: node.y, width: node.width, height: node.height, absoluteX: box?.x, absoluteY: box?.y, visible: node.visible, opacity: "opacity" in node ? node.opacity : undefined, rotation: "rotation" in node ? node.rotation : undefined, children, data }));
    if ("fills" in node && node.fills !== figma.mixed) for (const fill of node.fills) if (fill.type === "IMAGE" && fill.imageHash && !seenImages.has(fill.imageHash)) { try { seenImages.add(fill.imageHash); const image = figma.getImageByHash(fill.imageHash); if (image) { const bytes = await image.getBytesAsync(); files.push({ descriptor: { id: `image-${fill.imageHash}`, kind: "ASSET", hash: "pending", mimeType: "application/octet-stream", sourceNodeId: node.id, filename: `${fill.imageHash}.bin` }, bytes }); } } catch (error) { warnings.push(`Could not export image asset on ${path}: ${String(error)}`); } }
    if (node.type === "VECTOR") try { const svg = await node.exportAsync({ format: "SVG" }); files.push({ descriptor: { id: `svg-${node.id}`, kind: "ASSET", hash: "pending", mimeType: "image/svg+xml", sourceNodeId: node.id, filename: `${node.id.replace(/:/g, "-")}.svg`, width: node.width, height: node.height }, bytes: svg }); } catch (error) { warnings.push(`Could not export SVG on ${path}: ${String(error)}`); }
    if ("children" in node) for (const child of node.children) if (includeHidden || child.visible) await visit(child, node.id, [...names, node.name], depth + 1);
  }
  await visit(root, null, [], 0); return { nodes: result, warnings, files };
}

async function exportSnapshot(scope: "SELECTION" | "PAGE", endpoint: string, includeHidden: boolean, scale: number) {
  const roots: SceneNode[] = scope === "SELECTION" ? [...figma.currentPage.selection] : figma.currentPage.children.filter((node): node is SceneNode => node.type !== "SLICE" && (includeHidden || node.visible));
  if (!roots.length) throw new Error(scope === "SELECTION" ? "Select at least one node" : "The page has no exportable nodes");
  const root = roots.length === 1 ? roots[0]! : figma.group(roots, figma.currentPage); const temporaryGroup = roots.length > 1;
  if (temporaryGroup) root.name = scope === "PAGE" ? figma.currentPage.name : "Selection";
  try {
    figma.ui.postMessage({ type: "progress", message: "Reading variables…", value: 10 });
    const [variables, collections, paintStyles, textStyles, effectStyles, gridStyles] = await Promise.all([figma.variables.getLocalVariablesAsync(), figma.variables.getLocalVariableCollectionsAsync(), figma.getLocalPaintStylesAsync(), figma.getLocalTextStylesAsync(), figma.getLocalEffectStylesAsync(), figma.getLocalGridStylesAsync()]); const variableNames = new Map(variables.map((variable) => [variable.id, variable.name]));
    figma.ui.postMessage({ type: "progress", message: "Serializing nodes…", value: 25 }); const serialized = await serialize(root, variableNames, includeHidden);
    figma.ui.postMessage({ type: "progress", message: "Rendering screenshot…", value: 70 }); const png = await root.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: scale } });
    const screenshot: ExportFile = { descriptor: { id: `screenshot-${root.id}`, kind: "SCREENSHOT", hash: "pending", mimeType: "image/png", width: root.width * scale, height: root.height * scale, sourceNodeId: root.id, filename: `${root.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "frame"}.png` }, bytes: png };
    const components = serialized.nodes.filter((node) => ["COMPONENT", "COMPONENT_SET", "INSTANCE"].includes(node.type)).map((node) => ({ id: node.id, name: node.name, type: node.type, path: node.path, ...node.data }));
    const styles = [...paintStyles.map((style) => clean({ id: style.id, type: style.type, name: style.name, description: style.description, paints: paints(style.paints, variableNames) })), ...textStyles.map((style) => clean({ id: style.id, type: style.type, name: style.name, description: style.description, fontName: style.fontName, fontSize: style.fontSize, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing, textCase: style.textCase, textDecoration: style.textDecoration, paragraphIndent: style.paragraphIndent, paragraphSpacing: style.paragraphSpacing })), ...effectStyles.map((style) => clean({ id: style.id, type: style.type, name: style.name, description: style.description, effects: effects(style.effects) })), ...gridStyles.map((style) => clean({ id: style.id, type: style.type, name: style.name, description: style.description, layoutGrids: style.layoutGrids }))];
    const manifest: SnapshotManifest = { snapshotVersion: 1, pluginVersion: PLUGIN_VERSION, projectName: figma.root.name, documentName: figma.root.name, pageName: figma.currentPage.name, rootNodeId: root.id, rootNodeName: root.name, scope, exportedAt: new Date().toISOString(), nodes: serialized.nodes, assets: serialized.files.map((item) => item.descriptor), screenshots: [screenshot.descriptor], variables: variables.map((variable) => clean({ id: variable.id, name: variable.name, collectionId: variable.variableCollectionId, resolvedType: variable.resolvedType, valuesByMode: variable.valuesByMode, scopes: variable.scopes, description: variable.description })), collections: collections.map((collection) => clean({ id: collection.id, name: collection.name, modes: collection.modes, defaultModeId: collection.defaultModeId, variableIds: collection.variableIds })), styles, components, warnings: serialized.warnings };
    const form = new FormData(); form.set("manifest", JSON.stringify(manifest)); for (const file of [...serialized.files, screenshot]) form.set(`file:${file.descriptor.id}`, new Blob([new Uint8Array(file.bytes).buffer], { type: file.descriptor.mimeType }), file.descriptor.filename);
    figma.ui.postMessage({ type: "progress", message: "Uploading local snapshot…", value: 88 }); const response = await fetch(`${endpoint.replace(/\/$/, "")}/snapshots`, { method: "POST", body: form }); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? `Upload failed (${response.status})`);
    figma.ui.postMessage({ type: "result", result: { ...body, assets: serialized.files.length, screenshot: true }, warnings: serialized.warnings });
  } finally { if (temporaryGroup && root.type === "GROUP") figma.ungroup(root); }
}

figma.ui.onmessage = async (message) => {
  if (message.type === "ready") { postStatus(); return; }
  if (message.type === "ping") { try { const response = await fetch(`${message.endpoint}/health`); figma.ui.postMessage({ type: "connection", connected: response.ok }); } catch { figma.ui.postMessage({ type: "connection", connected: false }); } return; }
  if (message.type === "export") try { await exportSnapshot(message.scope, message.endpoint, message.includeHidden, message.scale); } catch (error) { console.error(error); figma.ui.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) }); }
};
