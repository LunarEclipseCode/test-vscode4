/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { PromptsConfig } from '../../../common/promptSyntax/config/config.js';
import { PromptsType } from '../../../common/promptSyntax/promptTypes.js';
import { randomInt } from '../../../../../../base/common/numbers.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { mockService } from '../promptSyntax/utils/mock.js';
/**
 * Mocked instance of {@link IConfigurationService}.
 */
const createMock = (value) => {
    return mockService({
        getValue(key) {
            assert(typeof key === 'string', `Expected string configuration key, got '${typeof key}'.`);
            assert([PromptsConfig.KEY, PromptsConfig.PROMPT_LOCATIONS_KEY, PromptsConfig.INSTRUCTIONS_LOCATION_KEY, PromptsConfig.MODE_LOCATION_KEY].includes(key), `Unsupported configuration key '${key}'.`);
            return value;
        },
    });
};
suite('PromptsConfig', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    suite('enabled', () => {
        test('true', () => {
            const configService = createMock(true);
            assert.strictEqual(PromptsConfig.enabled(configService), true, 'Must read correct enablement value.');
        });
        test('false', () => {
            const configService = createMock(false);
            assert.strictEqual(PromptsConfig.enabled(configService), false, 'Must read correct enablement value.');
        });
        test('null', () => {
            const configService = createMock(null);
            assert.strictEqual(PromptsConfig.enabled(configService), false, 'Must read correct enablement value.');
        });
        test('string', () => {
            const configService = createMock('');
            assert.strictEqual(PromptsConfig.enabled(configService), false, 'Must read correct enablement value.');
        });
        test('true string', () => {
            const configService = createMock('TRUE');
            assert.strictEqual(PromptsConfig.enabled(configService), true, 'Must read correct enablement value.');
        });
        test('false string', () => {
            const configService = createMock('FaLsE');
            assert.strictEqual(PromptsConfig.enabled(configService), false, 'Must read correct enablement value.');
        });
        test('number', () => {
            const configService = createMock(randomInt(100));
            assert.strictEqual(PromptsConfig.enabled(configService), false, 'Must read correct enablement value.');
        });
        test('NaN', () => {
            const configService = createMock(NaN);
            assert.strictEqual(PromptsConfig.enabled(configService), false, 'Must read correct enablement value.');
        });
        test('bigint', () => {
            const configService = createMock(BigInt(randomInt(100)));
            assert.strictEqual(PromptsConfig.enabled(configService), false, 'Must read correct enablement value.');
        });
        test('symbol', () => {
            const configService = createMock(Symbol('test'));
            assert.strictEqual(PromptsConfig.enabled(configService), false, 'Must read correct enablement value.');
        });
        test('object', () => {
            const configService = createMock({
                '.github/prompts': false,
            });
            assert.strictEqual(PromptsConfig.enabled(configService), false, 'Must read correct enablement value.');
        });
        test('array', () => {
            const configService = createMock(['.github/prompts']);
            assert.strictEqual(PromptsConfig.enabled(configService), false, 'Must read correct enablement value.');
        });
    });
    suite('getLocationsValue', () => {
        test('undefined', () => {
            const configService = createMock(undefined);
            assert.strictEqual(PromptsConfig.getLocationsValue(configService, PromptsType.prompt), undefined, 'Must read correct value.');
        });
        test('null', () => {
            const configService = createMock(null);
            assert.strictEqual(PromptsConfig.getLocationsValue(configService, PromptsType.prompt), undefined, 'Must read correct value.');
        });
        suite('object', () => {
            test('empty', () => {
                assert.deepStrictEqual(PromptsConfig.getLocationsValue(createMock({}), PromptsType.prompt), {}, 'Must read correct value.');
            });
            test('only valid strings', () => {
                assert.deepStrictEqual(PromptsConfig.getLocationsValue(createMock({
                    '/root/.bashrc': true,
                    '../../folder/.hidden-folder/config.xml': true,
                    '/srv/www/Public_html/.htaccess': true,
                    '../../another.folder/.WEIRD_FILE.log': true,
                    './folder.name/file.name': true,
                    '/media/external/backup.tar.gz': true,
                    '/Media/external/.secret.backup': true,
                    '../relative/path.to.file': true,
                    './folderName.with.dots/more.dots.extension': true,
                    'some/folder.with.dots/another.file': true,
                    '/var/logs/app.01.05.error': true,
                    './.tempfile': true,
                }), PromptsType.prompt), {
                    '/root/.bashrc': true,
                    '../../folder/.hidden-folder/config.xml': true,
                    '/srv/www/Public_html/.htaccess': true,
                    '../../another.folder/.WEIRD_FILE.log': true,
                    './folder.name/file.name': true,
                    '/media/external/backup.tar.gz': true,
                    '/Media/external/.secret.backup': true,
                    '../relative/path.to.file': true,
                    './folderName.with.dots/more.dots.extension': true,
                    'some/folder.with.dots/another.file': true,
                    '/var/logs/app.01.05.error': true,
                    './.tempfile': true,
                }, 'Must read correct value.');
            });
            test('filters out non valid entries', () => {
                assert.deepStrictEqual(PromptsConfig.getLocationsValue(createMock({
                    '/etc/hosts.backup': '\t\n\t',
                    './run.tests.sh': '\v',
                    '../assets/img/logo.v2.png': true,
                    '/mnt/storage/video.archive/episode.01.mkv': false,
                    '../.local/bin/script.sh': true,
                    '/usr/local/share/.fonts/CustomFont.otf': '',
                    '../../development/branch.name/some.test': true,
                    '/Home/user/.ssh/config': true,
                    './hidden.dir/.subhidden': '\f',
                    '/tmp/.temp.folder/cache.db': true,
                    '/opt/software/v3.2.1/build.log': '  ',
                    '': true,
                    './scripts/.old.build.sh': true,
                    '/var/data/datafile.2025-02-05.json': '\n',
                    '\n\n': true,
                    '\t': true,
                    '\v': true,
                    '\f': true,
                    '\r\n': true,
                    '\f\f': true,
                    '../lib/some_library.v1.0.1.so': '\r\n',
                    '/dev/shm/.shared_resource': randomInt(Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER),
                }), PromptsType.prompt), {
                    '../assets/img/logo.v2.png': true,
                    '/mnt/storage/video.archive/episode.01.mkv': false,
                    '../.local/bin/script.sh': true,
                    '../../development/branch.name/some.test': true,
                    '/Home/user/.ssh/config': true,
                    '/tmp/.temp.folder/cache.db': true,
                    './scripts/.old.build.sh': true,
                }, 'Must read correct value.');
            });
            test('only invalid or false values', () => {
                assert.deepStrictEqual(PromptsConfig.getLocationsValue(createMock({
                    '/etc/hosts.backup': '\t\n\t',
                    './run.tests.sh': '\v',
                    '../assets/IMG/logo.v2.png': '',
                    '/mnt/storage/video.archive/episode.01.mkv': false,
                    '/usr/local/share/.fonts/CustomFont.otf': '',
                    './hidden.dir/.subhidden': '\f',
                    '/opt/Software/v3.2.1/build.log': '  ',
                    '/var/data/datafile.2025-02-05.json': '\n',
                    '../lib/some_library.v1.0.1.so': '\r\n',
                    '/dev/shm/.shared_resource': randomInt(Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER),
                }), PromptsType.prompt), {
                    '/mnt/storage/video.archive/episode.01.mkv': false,
                }, 'Must read correct value.');
            });
        });
    });
    suite('sourceLocations', () => {
        test('undefined', () => {
            const configService = createMock(undefined);
            assert.deepStrictEqual(PromptsConfig.promptSourceFolders(configService, PromptsType.prompt), [], 'Must read correct value.');
        });
        test('null', () => {
            const configService = createMock(null);
            assert.deepStrictEqual(PromptsConfig.promptSourceFolders(configService, PromptsType.prompt), [], 'Must read correct value.');
        });
        suite('object', () => {
            test('empty', () => {
                assert.deepStrictEqual(PromptsConfig.promptSourceFolders(createMock({}), PromptsType.prompt), ['.github/prompts'], 'Must read correct value.');
            });
            test('only valid strings', () => {
                assert.deepStrictEqual(PromptsConfig.promptSourceFolders(createMock({
                    '/root/.bashrc': true,
                    '../../folder/.hidden-folder/config.xml': true,
                    '/srv/www/Public_html/.htaccess': true,
                    '../../another.folder/.WEIRD_FILE.log': true,
                    './folder.name/file.name': true,
                    '/media/external/backup.tar.gz': true,
                    '/Media/external/.secret.backup': true,
                    '../relative/path.to.file': true,
                    './folderName.with.dots/more.dots.extension': true,
                    'some/folder.with.dots/another.file': true,
                    '/var/logs/app.01.05.error': true,
                    '.GitHub/prompts': true,
                    './.tempfile': true,
                }), PromptsType.prompt), [
                    '.github/prompts',
                    '/root/.bashrc',
                    '../../folder/.hidden-folder/config.xml',
                    '/srv/www/Public_html/.htaccess',
                    '../../another.folder/.WEIRD_FILE.log',
                    './folder.name/file.name',
                    '/media/external/backup.tar.gz',
                    '/Media/external/.secret.backup',
                    '../relative/path.to.file',
                    './folderName.with.dots/more.dots.extension',
                    'some/folder.with.dots/another.file',
                    '/var/logs/app.01.05.error',
                    '.GitHub/prompts',
                    './.tempfile',
                ], 'Must read correct value.');
            });
            test('filters out non valid entries', () => {
                assert.deepStrictEqual(PromptsConfig.promptSourceFolders(createMock({
                    '/etc/hosts.backup': '\t\n\t',
                    './run.tests.sh': '\v',
                    '../assets/img/logo.v2.png': true,
                    '/mnt/storage/video.archive/episode.01.mkv': false,
                    '../.local/bin/script.sh': true,
                    '/usr/local/share/.fonts/CustomFont.otf': '',
                    '../../development/branch.name/some.test': true,
                    '.giThub/prompts': true,
                    '/Home/user/.ssh/config': true,
                    './hidden.dir/.subhidden': '\f',
                    '/tmp/.temp.folder/cache.db': true,
                    '.github/prompts': true,
                    '/opt/software/v3.2.1/build.log': '  ',
                    '': true,
                    './scripts/.old.build.sh': true,
                    '/var/data/datafile.2025-02-05.json': '\n',
                    '\n\n': true,
                    '\t': true,
                    '\v': true,
                    '\f': true,
                    '\r\n': true,
                    '\f\f': true,
                    '../lib/some_library.v1.0.1.so': '\r\n',
                    '/dev/shm/.shared_resource': randomInt(Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER),
                }), PromptsType.prompt), [
                    '.github/prompts',
                    '../assets/img/logo.v2.png',
                    '../.local/bin/script.sh',
                    '../../development/branch.name/some.test',
                    '.giThub/prompts',
                    '/Home/user/.ssh/config',
                    '/tmp/.temp.folder/cache.db',
                    './scripts/.old.build.sh',
                ], 'Must read correct value.');
            });
            test('only invalid or false values', () => {
                assert.deepStrictEqual(PromptsConfig.promptSourceFolders(createMock({
                    '/etc/hosts.backup': '\t\n\t',
                    './run.tests.sh': '\v',
                    '../assets/IMG/logo.v2.png': '',
                    '/mnt/storage/video.archive/episode.01.mkv': false,
                    '/usr/local/share/.fonts/CustomFont.otf': '',
                    './hidden.dir/.subhidden': '\f',
                    '/opt/Software/v3.2.1/build.log': '  ',
                    '/var/data/datafile.2025-02-05.json': '\n',
                    '../lib/some_library.v1.0.1.so': '\r\n',
                    '/dev/shm/.shared_resource': randomInt(Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER),
                }), PromptsType.prompt), [
                    '.github/prompts',
                ], 'Must read correct value.');
            });
            test('filters out disabled default location', () => {
                assert.deepStrictEqual(PromptsConfig.promptSourceFolders(createMock({
                    '/etc/hosts.backup': '\t\n\t',
                    './run.tests.sh': '\v',
                    '.github/prompts': false,
                    '../assets/img/logo.v2.png': true,
                    '/mnt/storage/video.archive/episode.01.mkv': false,
                    '../.local/bin/script.sh': true,
                    '/usr/local/share/.fonts/CustomFont.otf': '',
                    '../../development/branch.name/some.test': true,
                    '.giThub/prompts': true,
                    '/Home/user/.ssh/config': true,
                    './hidden.dir/.subhidden': '\f',
                    '/tmp/.temp.folder/cache.db': true,
                    '/opt/software/v3.2.1/build.log': '  ',
                    '': true,
                    './scripts/.old.build.sh': true,
                    '/var/data/datafile.2025-02-05.json': '\n',
                    '\n\n': true,
                    '\t': true,
                    '\v': true,
                    '\f': true,
                    '\r\n': true,
                    '\f\f': true,
                    '../lib/some_library.v1.0.1.so': '\r\n',
                    '/dev/shm/.shared_resource': randomInt(Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER),
                }), PromptsType.prompt), [
                    '../assets/img/logo.v2.png',
                    '../.local/bin/script.sh',
                    '../../development/branch.name/some.test',
                    '.giThub/prompts',
                    '/Home/user/.ssh/config',
                    '/tmp/.temp.folder/cache.db',
                    './scripts/.old.build.sh',
                ], 'Must read correct value.');
            });
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvdGVzdC9jb21tb24vY29uZmlnL2NvbmZpZy50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUU1QixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDOUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQzFFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNyRSxPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUV0RyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFFNUQ7O0dBRUc7QUFDSCxNQUFNLFVBQVUsR0FBRyxDQUFJLEtBQVEsRUFBeUIsRUFBRTtJQUN6RCxPQUFPLFdBQVcsQ0FBd0I7UUFDekMsUUFBUSxDQUFDLEdBQXNDO1lBQzlDLE1BQU0sQ0FDTCxPQUFPLEdBQUcsS0FBSyxRQUFRLEVBQ3ZCLDJDQUEyQyxPQUFPLEdBQUcsSUFBSSxDQUN6RCxDQUFDO1lBRUYsTUFBTSxDQUNMLENBQUMsYUFBYSxDQUFDLEdBQUcsRUFBRSxhQUFhLENBQUMsb0JBQW9CLEVBQUUsYUFBYSxDQUFDLHlCQUF5QixFQUFFLGFBQWEsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFDL0ksa0NBQWtDLEdBQUcsSUFBSSxDQUN6QyxDQUFDO1lBRUYsT0FBTyxLQUFLLENBQUM7UUFDZCxDQUFDO0tBQ0QsQ0FBQyxDQUFDO0FBQ0osQ0FBQyxDQUFDO0FBRUYsS0FBSyxDQUFDLGVBQWUsRUFBRSxHQUFHLEVBQUU7SUFDM0IsdUNBQXVDLEVBQUUsQ0FBQztJ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