import type { AssetManifest, AssetManifestEntry } from 'zhuda-laya-engine';

export interface AssetBrowserOptions {
  manifest: AssetManifest;
  selectedId?: string;
  onOpen(entry: AssetManifestEntry): void;
}

function kindOf(entry: AssetManifestEntry): string {
  const extension = entry.id.split('.').pop()?.toLowerCase();
  if (extension === 'ls') return 'scene';
  if (extension === 'lh') return 'prefab';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension || '')) return 'image';
  if (['glb', 'gltf'].includes(extension || '')) return 'model';
  if (entry.kind) return entry.kind;
  return 'unknown';
}

function labelOf(id: string): string {
  return id.split('/').pop() || id;
}

function formatBytes(bytes: number | undefined): string {
  if (!Number.isFinite(bytes) || !bytes) return 'size —';
  if (bytes >= 1024 * 1024) return `size ${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `size ${(bytes / 1024).toFixed(1)} KB`;
  return `size ${bytes} B`;
}

/** Render the manifest-backed Project/Assets panel shared by prefab and Scene pages. */
export function installAssetBrowser(options: AssetBrowserOptions): void {
  const folderHost = document.querySelector<HTMLElement>('#asset-folders');
  const filesHost = document.querySelector<HTMLElement>('#asset-files');
  const pathLabel = document.querySelector<HTMLElement>('#asset-browser-path');
  const countLabel = document.querySelector<HTMLElement>('#asset-browser-count');
  if (!folderHost || !filesHost) return;

  const entries = [...options.manifest.entries].sort((a, b) => a.id.localeCompare(b.id));
  const folders = new Set<string>(['']);
  for (const entry of entries) {
    const parts = entry.id.split('/');
    parts.pop();
    for (let index = 1; index <= parts.length; index += 1)
      folders.add(parts.slice(0, index).join('/'));
  }
  const sortedFolders = [...folders].sort((a, b) => a.localeCompare(b));
  const normalizedSelectedId = options.selectedId?.replace(/^assets\//, '');
  const selectedEntry = normalizedSelectedId
    ? entries.find((entry) => entry.id === normalizedSelectedId)
    : undefined;
  let selectedFolder = selectedEntry ? selectedEntry.id.split('/').slice(0, -1).join('/') : '';
  let selectedId = selectedEntry?.id || '';

  const directEntries = (folder: string) => {
    const prefix = folder ? `${folder}/` : '';
    return entries.filter((entry) => {
      if (!entry.id.startsWith(prefix)) return false;
      return !entry.id.slice(prefix.length).includes('/');
    });
  };

  const renderFolders = () => {
    folderHost.replaceChildren();
    for (const folder of sortedFolders) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'asset-folder';
      button.classList.toggle('is-selected', folder === selectedFolder);
      const depth = folder ? folder.split('/').length : 0;
      button.style.paddingLeft = `${8 + depth * 14}px`;
      const icon = document.createElement('span');
      icon.className = 'asset-folder-icon';
      icon.textContent = folder ? '▰' : '▾';
      const label = document.createElement('span');
      label.textContent = folder ? labelOf(folder) : 'Assets';
      button.append(icon, label);
      button.title = folder ? `Open ${folder}` : 'Open all assets';
      button.addEventListener('click', () => {
        selectedFolder = folder;
        selectedId = '';
        renderFolders();
        renderFiles();
      });
      folderHost.appendChild(button);
    }
  };

  const renderFiles = () => {
    const currentEntries = directEntries(selectedFolder);
    if (pathLabel) pathLabel.textContent = selectedFolder ? `Assets / ${selectedFolder}` : 'Assets';
    if (countLabel)
      countLabel.textContent = `${currentEntries.length} file${currentEntries.length === 1 ? '' : 's'} · manifest locked`;
    filesHost.replaceChildren();
    if (!currentEntries.length) {
      const empty = document.createElement('div');
      empty.className = 'asset-empty';
      empty.textContent = '選擇左側資料夾查看資產';
      filesHost.appendChild(empty);
      return;
    }
    for (const entry of currentEntries) {
      const kind = kindOf(entry);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'asset-card';
      card.classList.toggle('is-selected', entry.id === selectedId);
      card.title = `${entry.id}\nSHA-256 ${entry.sha256 || '—'}`;
      const thumb = document.createElement('span');
      thumb.className = `asset-thumb kind-${kind}`;
      if (kind === 'image') {
        const image = document.createElement('img');
        image.alt = labelOf(entry.id);
        image.src = `assets/${entry.id}`;
        thumb.appendChild(image);
      } else {
        thumb.textContent =
          kind === 'scene'
            ? 'LS'
            : kind === 'prefab'
              ? 'LH'
              : kind === 'model'
                ? '3D'
                : kind.slice(0, 3).toUpperCase();
      }
      const meta = document.createElement('span');
      meta.className = 'asset-card-meta';
      const name = document.createElement('span');
      name.className = 'asset-card-name';
      name.textContent = labelOf(entry.id);
      const detail = document.createElement('span');
      detail.className = 'asset-card-detail';
      detail.textContent = `${kind} · ${formatBytes(entry.bytes)}`;
      meta.append(name, detail);
      card.append(thumb, meta);
      card.addEventListener('click', () => {
        selectedId = entry.id;
        renderFiles();
        options.onOpen(entry);
      });
      filesHost.appendChild(card);
    }
  };

  renderFolders();
  renderFiles();
}
