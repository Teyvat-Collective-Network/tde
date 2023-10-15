import toml from "@iarna/toml";
import { WebhookMessageCreateOptions } from "discord.js";
import { Sources, validateColor, validateEmbeds, validateFiles, validateMentions, validateProfile, validateString } from "./validation.ts";

const TDE = {
    parse(source: string, sources?: Sources): WebhookMessageCreateOptions {
        const object = toml.parse(source);

        const rootColor = validateColor("root color", object.color);
        const content = validateString("content", object.content, false, 2000);
        const profile = validateProfile("profile", object.profile);
        const embeds = validateEmbeds(sources, "embeds", object.embed);
        const files = validateFiles("files", object.file);
        const mentions = validateMentions("mentions", object.mentions);

        return {
            content,
            username: profile?.username,
            avatarURL: profile?.avatarURL,
            allowedMentions: mentions,
            embeds: embeds?.map((x) => ({
                ...x,
                author: x.author && { name: x.author.name, url: x.author.url, icon_url: x.author.icon },
                footer: x.footer && { text: x.footer.text, icon_url: x.footer.icon },
                image: x.image === undefined ? undefined : { url: x.image },
                thumbnail: x.thumbnail === undefined ? undefined : { url: x.thumbnail },
                video: x.video === undefined ? undefined : { url: x.video },
                timestamp: x.timestamp && x.timestamp.toISOString() + "Z",
                color: x.color ?? rootColor,
            })),
            files: files?.map((x) => ({ name: x.name, attachment: x.url })),
        };
    },
};

export default TDE;
