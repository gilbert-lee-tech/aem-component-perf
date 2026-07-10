export interface ComponentNode {
  path: string;
  resourceType: string;
  superResourceType?: string;
  jcrPrimaryType: string;
  /** Scalar JCR properties, excluding system metadata (uuid, timestamps, versioning). */
  properties: Record<string, string | number | boolean>;
  depth: number;
}

export interface PageData {
  pagePath: string;
  template: string;
  pageResourceType: string;
  /** All nodes with sling:resourceType, depth-first (document) order. */
  nodes: ComponentNode[];
}
