import fs from 'fs';

// Mach-O constants
const MH_MAGIC = 0xfeedface;
const MH_CIGAM = 0xcefaedfe;
const MH_MAGIC_64 = 0xfeedfacf;
const MH_CIGAM_64 = 0xcffaedfe;

const FAT_MAGIC = 0xcafebabe;
const FAT_CIGAM = 0xbebafeca;
const FAT_MAGIC_64 = 0xcafebabf;
const FAT_CIGAM_64 = 0xbfbafeca;

const CPU_TYPE_I386 = 0x00000007;
const CPU_TYPE_X86_64 = 0x01000007;
const CPU_TYPE_ARM = 0x0000000c;
const CPU_TYPE_ARM64 = 0x0100000c;

// Mach-O load command constants
const LC_LOAD_DYLIB = 0x0c;
const LC_LOAD_WEAK_DYLIB = 0x80000018;
const LC_REEXPORT_DYLIB = 0x8000001f;
const LC_LOAD_UPWARD_DYLIB = 0x8000001d;
const LC_LAZY_LOAD_DYLIB = 0x20;

// PE constants
const IMAGE_DOS_SIGNATURE = 0x5a4d; // 'MZ'
const IMAGE_NT_SIGNATURE = 0x00004550; // 'PE\0\0'
const IMAGE_FILE_MACHINE_I386 = 0x014c;
const IMAGE_FILE_MACHINE_AMD64 = 0x8664;
const IMAGE_FILE_MACHINE_ARM64 = 0xaa64;

// ELF constants
const ELF_MAGIC_0 = 0x7f;
const ELF_MAGIC_1 = 0x45; // 'E'
const ELF_MAGIC_2 = 0x4c; // 'L'
const ELF_MAGIC_3 = 0x46; // 'F'
const EM_386 = 0x03;
const EM_X86_64 = 0x3e;
const EM_AARCH64 = 0xb7;

function mapCpuTypeToArch(cputype) {
  if (cputype === CPU_TYPE_ARM64) return 'arm64';
  if (cputype === CPU_TYPE_X86_64) return 'x86_64';
  if (cputype === CPU_TYPE_I386) return 'x86';
  if (cputype === CPU_TYPE_ARM) return 'arm';
  return null;
}

function parseMachOArchitecture(fd, buffer, bytesRead) {
  if (bytesRead < 4) return 'unknown';

  const magicBE = buffer.readUInt32BE(0);
  const magicLE = buffer.readUInt32LE(0);

  // 1. FAT / Universal binary
  if (magicBE === FAT_MAGIC || magicLE === FAT_MAGIC) {
    const isLE = magicLE === FAT_MAGIC;
    if (bytesRead < 8) return 'unknown';
    const nfat_arch = isLE ? buffer.readUInt32LE(4) : buffer.readUInt32BE(4);

    const neededBytes = 8 + nfat_arch * 20;
    let fatBuf = buffer;
    if (bytesRead < neededBytes) {
      fatBuf = Buffer.alloc(neededBytes);
      fs.readSync(fd, fatBuf, 0, neededBytes, 0);
    }

    const archs = new Set();
    for (let i = 0; i < nfat_arch; i++) {
      const archOffset = 8 + i * 20;
      const cputype = isLE ? fatBuf.readUInt32LE(archOffset) : fatBuf.readUInt32BE(archOffset);
      const arch = mapCpuTypeToArch(cputype);
      if (arch) archs.add(arch);
    }

    if (archs.has('arm64') && archs.has('x86_64')) return 'universal';
    if (archs.size === 1) return [...archs][0];
    if (archs.size > 1) return 'universal';
    return 'unknown';
  }

  if (magicBE === FAT_MAGIC_64 || magicLE === FAT_MAGIC_64) {
    const isLE = magicLE === FAT_MAGIC_64;
    if (bytesRead < 8) return 'unknown';
    const nfat_arch = isLE ? buffer.readUInt32LE(4) : buffer.readUInt32BE(4);

    const neededBytes = 8 + nfat_arch * 32;
    let fatBuf = buffer;
    if (bytesRead < neededBytes) {
      fatBuf = Buffer.alloc(neededBytes);
      fs.readSync(fd, fatBuf, 0, neededBytes, 0);
    }

    const archs = new Set();
    for (let i = 0; i < nfat_arch; i++) {
      const archOffset = 8 + i * 32;
      const cputype = isLE ? fatBuf.readUInt32LE(archOffset) : fatBuf.readUInt32BE(archOffset);
      const arch = mapCpuTypeToArch(cputype);
      if (arch) archs.add(arch);
    }

    if (archs.has('arm64') && archs.has('x86_64')) return 'universal';
    if (archs.size === 1) return [...archs][0];
    if (archs.size > 1) return 'universal';
    return 'unknown';
  }

  // 2. Single 64-bit Mach-O
  if (magicLE === MH_MAGIC_64) {
    const cputype = buffer.readUInt32LE(4);
    return mapCpuTypeToArch(cputype) || 'unknown';
  }
  if (magicBE === MH_MAGIC_64) {
    const cputype = buffer.readUInt32BE(4);
    return mapCpuTypeToArch(cputype) || 'unknown';
  }

  // 3. Single 32-bit Mach-O
  if (magicLE === MH_MAGIC) {
    const cputype = buffer.readUInt32LE(4);
    return mapCpuTypeToArch(cputype) || 'unknown';
  }
  if (magicBE === MH_MAGIC) {
    const cputype = buffer.readUInt32BE(4);
    return mapCpuTypeToArch(cputype) || 'unknown';
  }

  return 'unknown';
}

function parsePEArchitecture(fd, buffer, bytesRead) {
  if (bytesRead < 0x40) return 'unknown';

  const dosSig = buffer.readUInt16LE(0);
  if (dosSig !== IMAGE_DOS_SIGNATURE) return 'unknown';

  const e_lfanew = buffer.readUInt32LE(0x3c);
  if (e_lfanew <= 0) return 'unknown';

  let peBuf = Buffer.alloc(24);
  const peRead = fs.readSync(fd, peBuf, 0, 24, e_lfanew);
  if (peRead < 6) return 'unknown';

  const peSig = peBuf.readUInt32LE(0);
  if (peSig !== IMAGE_NT_SIGNATURE) return 'unknown';

  const machine = peBuf.readUInt16LE(4);
  if (machine === IMAGE_FILE_MACHINE_AMD64) return 'x86_64';
  if (machine === IMAGE_FILE_MACHINE_I386) return 'x86';
  if (machine === IMAGE_FILE_MACHINE_ARM64) return 'arm64';

  return 'unknown';
}

function parseELFArchitecture(buffer, bytesRead) {
  if (bytesRead < 20) return 'unknown';

  if (
    buffer[0] !== ELF_MAGIC_0 ||
    buffer[1] !== ELF_MAGIC_1 ||
    buffer[2] !== ELF_MAGIC_2 ||
    buffer[3] !== ELF_MAGIC_3
  ) {
    return 'unknown';
  }

  const isLE = buffer[5] === 1; // EI_DATA
  const e_machine = isLE ? buffer.readUInt16LE(18) : buffer.readUInt16BE(18);

  if (e_machine === EM_X86_64) return 'x86_64';
  if (e_machine === EM_AARCH64) return 'arm64';
  if (e_machine === EM_386) return 'x86';

  return 'unknown';
}

/**
 * Determine binary architecture from file header.
 * @param {string} filePath
 * @param {string} [platform] - 'darwin' | 'win32' | 'linux'
 * @returns {'x86_64' | 'arm64' | 'universal' | 'x86' | 'arm' | 'unknown'}
 */
export function getBinaryArchitecture(filePath, platform) {
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(4096);
    const bytesRead = fs.readSync(fd, buffer, 0, 4096, 0);
    if (bytesRead < 4) return 'unknown';

    // Check by magic first
    const magicBE = buffer.readUInt32BE(0);
    const magicLE = buffer.readUInt32LE(0);

    const isMachO =
      magicBE === FAT_MAGIC || magicLE === FAT_MAGIC ||
      magicBE === FAT_MAGIC_64 || magicLE === FAT_MAGIC_64 ||
      magicBE === MH_MAGIC_64 || magicLE === MH_MAGIC_64 ||
      magicBE === MH_MAGIC || magicLE === MH_MAGIC;

    const isPE = buffer.readUInt16LE(0) === IMAGE_DOS_SIGNATURE;
    const isELF =
      buffer[0] === ELF_MAGIC_0 &&
      buffer[1] === ELF_MAGIC_1 &&
      buffer[2] === ELF_MAGIC_2 &&
      buffer[3] === ELF_MAGIC_3;

    if (platform === 'darwin' || (platform === undefined && isMachO)) {
      if (isMachO) return parseMachOArchitecture(fd, buffer, bytesRead);
    }

    if (platform === 'win32' || (platform === undefined && isPE)) {
      if (isPE) return parsePEArchitecture(fd, buffer, bytesRead);
    }

    if (platform === 'linux' || (platform === undefined && isELF)) {
      if (isELF) return parseELFArchitecture(buffer, bytesRead);
    }

    // Fallback if platform was specified but magic didn't match platform expectation
    if (isMachO) return parseMachOArchitecture(fd, buffer, bytesRead);
    if (isPE) return parsePEArchitecture(fd, buffer, bytesRead);
    if (isELF) return parseELFArchitecture(buffer, bytesRead);

    return 'unknown';
  } catch {
    return 'unknown';
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch { /* ignore */ }
    }
  }
}

/**
 * Pure-JS Mach-O load command parser to extract linked libraries (LC_LOAD_DYLIB, etc.).
 * Zero external command dependencies.
 * @param {string} filePath
 * @returns {string[]} Array of linked dylib / framework paths
 */
export function getMachOLinkedLibraries(filePath) {
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const headerBuf = Buffer.alloc(4096);
    const bytesRead = fs.readSync(fd, headerBuf, 0, 4096, 0);
    if (bytesRead < 8) return [];

    let sliceOffset = 0;
    const magicBE = headerBuf.readUInt32BE(0);
    const magicLE = headerBuf.readUInt32LE(0);

    // If FAT binary, pick the first 64-bit slice or the first available slice
    if (magicBE === FAT_MAGIC || magicLE === FAT_MAGIC) {
      const isFatLE = magicLE === FAT_MAGIC;
      const nfat_arch = isFatLE ? headerBuf.readUInt32LE(4) : headerBuf.readUInt32BE(4);
      let chosenOffset = null;
      let firstOffset = null;

      const neededBytes = 8 + nfat_arch * 20;
      let fatBuf = headerBuf;
      if (bytesRead < neededBytes) {
        fatBuf = Buffer.alloc(neededBytes);
        fs.readSync(fd, fatBuf, 0, neededBytes, 0);
      }

      for (let i = 0; i < nfat_arch; i++) {
        const archOffset = 8 + i * 20;
        const cputype = isFatLE ? fatBuf.readUInt32LE(archOffset) : fatBuf.readUInt32BE(archOffset);
        const curOffset = isFatLE ? fatBuf.readUInt32LE(archOffset + 8) : fatBuf.readUInt32BE(archOffset + 8);
        if (firstOffset === null) firstOffset = curOffset;
        if ((cputype & 0x01000000) !== 0) {
          chosenOffset = curOffset;
          break;
        }
      }
      sliceOffset = chosenOffset !== null ? chosenOffset : (firstOffset || 0);
    } else if (magicBE === FAT_MAGIC_64 || magicLE === FAT_MAGIC_64) {
      const isFatLE = magicLE === FAT_MAGIC_64;
      const nfat_arch = isFatLE ? headerBuf.readUInt32LE(4) : headerBuf.readUInt32BE(4);
      let chosenOffset = null;
      let firstOffset = null;

      const neededBytes = 8 + nfat_arch * 32;
      let fatBuf = headerBuf;
      if (bytesRead < neededBytes) {
        fatBuf = Buffer.alloc(neededBytes);
        fs.readSync(fd, fatBuf, 0, neededBytes, 0);
      }

      for (let i = 0; i < nfat_arch; i++) {
        const archOffset = 8 + i * 32;
        const cputype = isFatLE ? fatBuf.readUInt32LE(archOffset) : fatBuf.readUInt32BE(archOffset);
        const curOffset = Number(isFatLE ? fatBuf.readBigUInt64LE(archOffset + 8) : fatBuf.readBigUInt64BE(archOffset + 8));
        if (firstOffset === null) firstOffset = curOffset;
        if ((cputype & 0x01000000) !== 0) {
          chosenOffset = curOffset;
          break;
        }
      }
      sliceOffset = chosenOffset !== null ? chosenOffset : (firstOffset || 0);
    }

    const sliceHeader = Buffer.alloc(32);
    const sliceHeaderRead = fs.readSync(fd, sliceHeader, 0, 32, sliceOffset);
    if (sliceHeaderRead < 28) return [];

    const sMagicBE = sliceHeader.readUInt32BE(0);
    const sMagicLE = sliceHeader.readUInt32LE(0);

    let is64 = false;
    let isSliceLE = false;

    if (sMagicLE === MH_MAGIC_64) { is64 = true; isSliceLE = true; }
    else if (sMagicBE === MH_MAGIC_64) { is64 = true; isSliceLE = false; }
    else if (sMagicLE === MH_MAGIC) { is64 = false; isSliceLE = true; }
    else if (sMagicBE === MH_MAGIC) { is64 = false; isSliceLE = false; }
    else { return []; }

    const ncmds = isSliceLE ? sliceHeader.readUInt32LE(16) : sliceHeader.readUInt32BE(16);
    const sizeofcmds = isSliceLE ? sliceHeader.readUInt32LE(20) : sliceHeader.readUInt32BE(20);

    if (sizeofcmds <= 0 || sizeofcmds > 10 * 1024 * 1024 || ncmds <= 0) return [];

    const cmdsBuf = Buffer.alloc(sizeofcmds);
    const headerSize = is64 ? 32 : 28;
    const cmdsRead = fs.readSync(fd, cmdsBuf, 0, sizeofcmds, sliceOffset + headerSize);
    if (cmdsRead < sizeofcmds) return [];

    const dylibs = [];
    let cur = 0;

    for (let i = 0; i < ncmds && cur + 8 <= sizeofcmds; i++) {
      const cmd = isSliceLE ? cmdsBuf.readUInt32LE(cur) : cmdsBuf.readUInt32BE(cur);
      const cmdsize = isSliceLE ? cmdsBuf.readUInt32LE(cur + 4) : cmdsBuf.readUInt32BE(cur + 4);
      if (cmdsize < 8) break;

      const isDylibCmd =
        cmd === LC_LOAD_DYLIB ||
        cmd === LC_LOAD_WEAK_DYLIB ||
        cmd === LC_REEXPORT_DYLIB ||
        cmd === LC_LOAD_UPWARD_DYLIB ||
        cmd === LC_LAZY_LOAD_DYLIB;

      if (isDylibCmd && cur + 8 <= sizeofcmds) {
        const strOffset = isSliceLE ? cmdsBuf.readUInt32LE(cur + 8) : cmdsBuf.readUInt32BE(cur + 8);
        if (strOffset < cmdsize && cur + strOffset < sizeofcmds) {
          const maxEnd = Math.min(sizeofcmds, cur + cmdsize);
          const rawStr = cmdsBuf.subarray(cur + strOffset, maxEnd);
          const nullIdx = rawStr.indexOf(0);
          const str = (nullIdx >= 0 ? rawStr.subarray(0, nullIdx) : rawStr).toString('utf8');
          if (str) dylibs.push(str);
        }
      }
      cur += cmdsize;
    }

    return dylibs;
  } catch {
    return [];
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch { /* ignore */ }
    }
  }
}
