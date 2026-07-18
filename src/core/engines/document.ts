import { createToken } from '../registry';
import { type Result, Ok, Err, AppError } from '../result';
import type { Actor, UUID } from '../types';
import { googleIntegration } from '../../shared/integration/google';

export interface DocumentVersion {
  version: number;
  fileSize: number;
  uploadedBy: UUID;
  uploadedAt: string;
  downloadUrl: string;
}

export interface DocumentMetadata {
  id: UUID;
  name: string;
  mimeType: string;
  versions: DocumentVersion[];
  currentVersion: number;
  googleDriveFileId?: string;
  sharepointItemId?: string;
  permissions: {
    userId: UUID;
    accessLevel: 'read' | 'write' | 'owner';
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface IDocumentEngine {
  uploadDocument(
    name: string,
    mimeType: string,
    size: number,
    content: ArrayBuffer,
    actor: Actor
  ): Promise<Result<DocumentMetadata>>;
  addVersion(
    docId: UUID,
    size: number,
    content: ArrayBuffer,
    actor: Actor
  ): Promise<Result<DocumentMetadata>>;
  getDocument(docId: UUID, actor: Actor): Promise<Result<DocumentMetadata>>;
  verifyPermission(docId: UUID, userId: UUID, level: 'read' | 'write'): Promise<boolean>;
}

export const DOCUMENT_ENGINE_TOKEN = createToken<IDocumentEngine>('DocumentEngine');

export class DocumentEngine implements IDocumentEngine {
  private documents = new Map<UUID, DocumentMetadata>();

  private uuid(): UUID {
    return (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) as UUID;
  }

  async uploadDocument(
    name: string,
    mimeType: string,
    size: number,
    content: ArrayBuffer,
    actor: Actor
  ): Promise<Result<DocumentMetadata>> {
    try {
      const ts = new Date().toISOString();
      const docId = this.uuid();

      // Dispatch to Google Drive integration
      const driveUrl = await googleIntegration.uploadFile(name, mimeType, content, 'Documents');

      const version: DocumentVersion = {
        version: 1,
        fileSize: size,
        uploadedBy: actor.id,
        uploadedAt: ts,
        downloadUrl: driveUrl,
      };

      const doc: DocumentMetadata = {
        id: docId,
        name,
        mimeType,
        versions: [version],
        currentVersion: 1,
        googleDriveFileId: driveUrl.split('/').find((s) => s.startsWith('mock-')),
        permissions: [{ userId: actor.id, accessLevel: 'owner' }],
        createdAt: ts,
        updatedAt: ts,
      };

      this.documents.set(docId, doc);
      return Ok(doc);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async addVersion(
    docId: UUID,
    size: number,
    content: ArrayBuffer,
    actor: Actor
  ): Promise<Result<DocumentMetadata>> {
    const doc = this.documents.get(docId);
    if (!doc) return Err(AppError.notFound('Document not found.'));

    const isAuthorized = await this.verifyPermission(docId, actor.id, 'write');
    if (!isAuthorized) return Err(AppError.forbidden('Unauthorized access.'));

    try {
      const ts = new Date().toISOString();
      const newVersionNum = doc.currentVersion + 1;
      const driveUrl = await googleIntegration.uploadFile(doc.name, doc.mimeType, content, `Documents/v${newVersionNum}`);

      const version: DocumentVersion = {
        version: newVersionNum,
        fileSize: size,
        uploadedBy: actor.id,
        uploadedAt: ts,
        downloadUrl: driveUrl,
      };

      doc.versions.push(version);
      doc.currentVersion = newVersionNum;
      doc.updatedAt = ts;

      this.documents.set(doc.id, doc);
      return Ok(doc);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async getDocument(docId: UUID, actor: Actor): Promise<Result<DocumentMetadata>> {
    const doc = this.documents.get(docId);
    if (!doc) return Err(AppError.notFound('Document not found.'));

    const isAuthorized = await this.verifyPermission(docId, actor.id, 'read');
    if (!isAuthorized) return Err(AppError.forbidden('Unauthorized access.'));

    return Ok(doc);
  }

  async verifyPermission(docId: UUID, userId: UUID, level: 'read' | 'write'): Promise<boolean> {
    const doc = this.documents.get(docId);
    if (!doc) return false;

    const userPerm = doc.permissions.find((p) => p.userId === userId);
    if (!userPerm) return false;

    if (level === 'read') return true;
    return userPerm.accessLevel === 'write' || userPerm.accessLevel === 'owner';
  }
}
