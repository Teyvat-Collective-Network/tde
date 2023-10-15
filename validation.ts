import { MessageMentionOptions } from "discord.js";

export type Sources = Record<string, (args: any) => any> | undefined;

function inject(options: any, sources: Sources, key: string) {
    let source: any;

    if (typeof options === "string") source = options;
    else if (typeof options === "object") source = options.source;

    if (typeof source !== "string") throw err(key, "injection options should be a string or contain a source field");

    const fn = sources?.[source];
    if (!fn) throw err(key, `invalid injection source: ${source}`);

    return fn(typeof options === "string" ? {} : Object.fromEntries(Object.entries(options).filter(([x]) => x !== "source")));
}

function maybeInject(item: any, sources: Sources, key: string) {
    return item.inject ? inject(item.inject, sources, key) : item;
}

function err(key: string, string: string) {
    return new Error(`Invalid ${key}: ${string}.`);
}

function validateBoolean(key: string, boolean: any): boolean | undefined {
    if (boolean === undefined) return;

    if (typeof boolean !== "boolean") throw err(key, "expected a boolean");

    return boolean;
}

export function validateString<T extends boolean, U = T extends true ? string : string | undefined>(
    key: string,
    string: any,
    required: T,
    maxLength: number,
): U {
    if (string === undefined) {
        if (required) throw err(key, "required");
        else return undefined as U;
    }

    if (typeof string !== "string") throw err(key, "expected a string");

    string = string.trim();
    if (string === "") throw err(key, "expected a non-empty string (or exclude the field)");
    if (string.length > maxLength) throw err(key, `maximum length is ${maxLength}.`);

    return string;
}

function validateDate(key: string, date: any): Date | undefined {
    if (date === undefined) return;

    if (!(date instanceof Date)) throw err(key, "expected a date");

    return date;
}

export function validateColor(key: string, color: any): number | undefined {
    if (color === undefined) return;

    if (typeof color !== "number") throw err(key, "expected a number");

    if (color % 1 !== 0) throw err(key, "expected an integer");
    if (color < 0 || color > 0xffffff) throw err(key, "out of range (0x000000 - 0xffffff)");

    return color;
}

function validateURL<T extends boolean, U = T extends true ? string : string | undefined>(key: string, url: any, required: T): U {
    if (url === undefined)
        if (required) throw err(key, "required");
        else return undefined as U;

    if (typeof url !== "string") throw err(key, "expected a string");

    url = url.trim();
    if (url.length === 0) throw err(key, "expected non-empty string (or exclude the field)");
    if (!url.match(/^https?:\/\//)) throw err(key, "expected it to start with http:// or https://");

    return url;
}

type Profile = { username?: string; avatarURL?: string };

export function validateProfile(key: string, profile: any): Profile | undefined {
    if (profile === undefined) return;

    if (typeof profile !== "object") throw err(key, "expected an object");

    return { username: validateString(`${key} username`, profile.name, false, 80), avatarURL: validateURL(`${key} avatar URL`, profile.avatar, false) };
}

type Footer = { text: string; icon?: string };

function validateFooter(key: string, footer: any): Footer | undefined {
    if (footer === undefined) return;

    if (typeof footer !== "object") throw err(key, "expected an object");

    return { text: validateString(`${key} text`, footer.text, true, 2048), icon: validateURL(`${key} icon URL`, footer.icon, false) };
}

type Author = { name: string; icon?: string; url?: string };

function validateAuthor(key: string, author: any): Author | undefined {
    if (author === undefined) return;

    if (typeof author !== "object") throw err(key, "expected an object");

    return {
        name: validateString(`${key} name`, author.name, true, 256),
        icon: validateURL(`${key} icon URL`, author.icon, false),
        url: validateURL(`${key} URL`, author.url, false),
    };
}

type Field = { name: string; value: string; inline?: boolean };

function validateField(sources: Sources, key: string, field: any): Field[] {
    if (typeof field !== "object") throw err(key, "expected an object");

    field = maybeInject(field, sources, key);
    if (!Array.isArray(field)) field = [field];

    return (field as any[]).map((f) => ({
        name: validateString(`${key} name`, f.name, true, 256),
        value: validateString(`${key} value`, f.value, true, 1024),
        inline: validateBoolean(`${key} inline`, f.inline),
    }));
}

function validateFields(sources: Sources, key: string, fields: any): Field[] | undefined {
    if (fields === undefined) return undefined;

    if (!Array.isArray(fields)) throw err(`${key} fields`, "expected an array");

    const output = fields.flatMap((field, index) => validateField(sources, `${key} field ${index + 1}`, field));
    if (output.length > 25) throw err(`${key} fields`, "maximum length is 25");

    return output;
}

type Embed = {
    title?: string;
    description?: string;
    url?: string;
    timestamp?: Date;
    color?: number;
    footer?: Footer;
    image?: string;
    thumbnail?: string;
    video?: string;
    author?: Author;
    fields?: Field[];
};

function validateEmbed(sources: Sources, key: string, embed: any): Embed[] {
    if (typeof embed !== "object") throw err(key, "expected an object");

    embed = maybeInject(embed, sources, key);
    if (!Array.isArray(embed)) embed = [embed];

    return (embed as any[]).map((e) => ({
        title: validateString(`${key} title`, e.title, false, 256),
        description: validateString(`${key} description`, e.description, false, 4096),
        url: validateURL(`${key} URL`, e.url, false),
        timestamp: validateDate(`${key} timestamp`, e.timestamp),
        color: validateColor(`${key} color`, e.color),
        footer: validateFooter(`${key} footer`, e.footer),
        image: validateURL(`${key} image URL`, e.image, false),
        thumbnail: validateURL(`${key} thumbnail URL`, e.thumbnail, false),
        video: validateURL(`${key} video URL`, e.video, false),
        author: validateAuthor(`${key} author`, e.author),
        fields: validateFields(sources, `${key} fields`, e.field),
    }));
}

export function validateEmbeds(sources: Sources, key: string, embeds: any): Embed[] | undefined {
    if (embeds === undefined) return undefined;

    if (!Array.isArray(embeds)) embeds = [embeds];

    const output = (embeds as any[]).flatMap((embed, index) => validateEmbed(sources, `embed ${index + 1}`, embed));
    if (output.length > 10) throw err(key, "maximum length is 10");

    return output;
}

type File = { name: string; url: string };

function validateFile(key: string, file: any): File {
    if (typeof file !== "object") throw err(key, "expected an object");

    return {
        name: validateString(`${key} filename`, file.name, true, 256),
        url: validateURL(`${key} attachment URL`, file.url, true),
    };
}

export function validateFiles(key: string, files: any): File[] | undefined {
    if (files === undefined) return;

    if (!Array.isArray(files)) throw err(key, "expected an array");

    if (files.length > 10) throw err(key, "maximum length is 10");

    return files.map((file, index) => validateFile(`file ${index + 1}`, file));
}

function validateBooleanOrStringArray(key: string, object: any): boolean | string[] | undefined {
    if (object === undefined) return;

    if (typeof object === "boolean") return object;
    if (!Array.isArray(object)) throw err(key, "expected a string array or a boolean");

    return object.map((x, i) => validateString(`${key} element ${i + 1}`, x, true, Infinity));
}

export function validateMentions(key: string, mentions: any): MessageMentionOptions | undefined {
    if (mentions === undefined) return;

    if (typeof mentions !== "object") throw err(key, "expected an object");

    const everyone = validateBoolean(`${key} everyone`, mentions.everyone) ?? false;
    const users = validateBooleanOrStringArray(`${key} users`, mentions.users) ?? false;
    const roles = validateBooleanOrStringArray(`${key} roles`, mentions.roles) ?? false;

    return {
        parse: [...(everyone ? (["everyone"] as const) : []), ...(users ? (["users"] as const) : []), ...(roles ? (["roles"] as const) : [])],
        users: typeof users === "boolean" ? undefined : users,
        roles: typeof roles === "boolean" ? undefined : roles,
    };
}
