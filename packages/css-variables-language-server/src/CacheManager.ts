/**
 * Cache Manager
 *
 * {
 * 	 src/styles/variables.css: {
 * 	 },
 *   all: {
 * 			--red: #355324,
 *      --green: #664435
 * 	 }
 * }
 */

export default class CacheManager<T> {
	private cachedVariables: Map<string, Map<string, T>> = new Map();
	private allVariables: Map<string, T> = new Map();

	public get(key: string, filePath?: string) {
		if (filePath) {
			return this.cachedVariables.get(filePath)?.get(key);
		}

		return this.allVariables?.get(key);
	}

	public getAll(filePath?: string) {
		if (filePath) {
			return this.cachedVariables.get(filePath);
		}

		return this.allVariables;
	}

	public getFiles() {
		return this.cachedVariables.keys();
	}

	public set(filePath: string, key: string, value: T) {
		if (!this.cachedVariables.get(filePath)) {
			this.cachedVariables.set(filePath, new Map());
		}

		this.allVariables.set(key, value);
		this.cachedVariables.get(filePath).set(key, value);
	}

	public clearFileCache(filePath: string) {
		this.cachedVariables.get(filePath)?.forEach((_, key) => {
			this.allVariables?.delete(key);
		});
		this.cachedVariables.get(filePath)?.clear();
	}

	public clearAllCache() {
		this.allVariables?.clear();
		this.cachedVariables.clear();
	}
}
