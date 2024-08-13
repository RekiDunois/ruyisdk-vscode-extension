import { runCommand } from './utils'

export interface News {
    ty: string;
    id: string;
    ord: number;
    is_read: boolean;
    langs: {
        lang: string;
        display_title: string;
        content: string;
    }[]
}

export interface Package {
    ty: string;
    category: string;
    name: string;
    vers: {
        semver: string;
        pm: {
            format: string;
            toolchain: {
                target: string;
                included_sysroot?: string;
            };
        };
        remarks: string[];
    }[]
}

export async function profiles(): Promise<string[]> {
    const commandResult = await runCommand(['list', 'profiles']);
    return commandResult.split('\n').map(profile => profile.split(' ')[0]);
}

export async function news(): Promise<News[]> {
    const commandResult = await runCommand(['news', 'list']);
    const newsNd = commandResult.split('\n');
    return newsNd.map(news => {
        return JSON.parse(news);
    });
}

export async function packages(): Promise<Package[]> {
    const commandResult = await runCommand(['list']);
    const packagesNd = commandResult.split('\n');
    return packagesNd.map(package_ => {
        return JSON.parse(package_);
    });
}

export async function toolchains(): Promise<Package[]> {
    const allowedCategories = ['toolchain'];
    const p = await packages();
    return p.filter(package_ => allowedCategories.includes(package_.category));
}

export async function sources(): Promise<Package[]> {
    const allowedCategories = ['source'];
    const p = await packages();
    return p.filter(package_ => allowedCategories.includes(package_.category));
}

export async function installablePackages(): Promise<Package[]> {
    const allowedCategories = ['toolchain', 'analyzer', 'board-image', 'emulator'];
    const p = await packages();
    return p.filter(package_ => allowedCategories.includes(package_.category));
}

export async function venv(name: string, profile: string, toolchain: string, sysroot?: string): Promise<string> {
    let args = ['venv', profile, name, '-t', toolchain];
    if (sysroot) args.push('--sysroot-from', sysroot);
    return await runCommand(args);
}

export async function install(package_: string, ver?: string): Promise<string> {
    let args = ['install'];
    if (ver) {
        args.push(`${package_}(${ver})`);
    } else {
        args.push(package_);
    }
    return await runCommand(args);
}

export async function extract(package_: string, workdir: string): Promise<string> {
    return await runCommand(['extract', package_], workdir);
}