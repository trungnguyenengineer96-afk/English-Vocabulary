// Embeds the app icon and version info into the Windows .exe using a pure-JS
// resource editor, so Windows installers can be built on Linux without Wine.
const fs = require('node:fs');
const path = require('node:path');
const ResEdit = require('resedit');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const { productFilename } = context.packager.appInfo;
  const version = context.packager.appInfo.version;
  const exePath = path.join(context.appOutDir, `${productFilename}.exe`);
  const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(exe);

  const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(__dirname, '..', 'build', 'icon.ico')));
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const groupId = groups.length ? groups[0].id : 1;
  const lang = groups.length ? groups[0].lang : 1033;
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, groupId, lang, iconFile.icons.map((i) => i.data));

  const [vi] = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
  const parts = version.split('.').map(Number);
  vi.setFileVersion(parts[0], parts[1], parts[2], 0, 1033);
  vi.setProductVersion(parts[0], parts[1], parts[2], 0, 1033);
  vi.setStringValues(
    { lang: 1033, codepage: 1200 },
    {
      FileDescription: 'Vocab Quest',
      ProductName: 'Vocab Quest',
      CompanyName: 'Vocab Quest',
      LegalCopyright: 'Vocab Quest',
      OriginalFilename: `${productFilename}.exe`,
      InternalName: productFilename,
    },
  );
  vi.outputToResourceEntries(res.entries);
  res.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));
};
