import { describe, expect, it } from "vitest";

import {
  extractContactCreatedFields,
  extractWebhookSessionFields,
  inboundContactCreateTimeCandidate,
  isSupportedYCloudInboundType,
  YCLOUD_WHATSAPP_INBOUND_TYPE,
} from "./ycloud";

/** YCloud-style plain inbound (shape aligned with public docs) */
const inboundTextPlain = {
  id: "evt_eEkn26qar3nOB8md",
  type: YCLOUD_WHATSAPP_INBOUND_TYPE,
  apiVersion: "v2",
  createTime: "2023-02-22T12:00:00.000Z",
  whatsappInboundMessage: {
    id: "63f872f6741c165b4342a751",
    wamid: "wamid.HBgNODi",
    wabaId: "WABA-ID",
    from: "16315551111",
    fromUserId: "US.13491208655302741918",
    customerProfile: {
      name: "Joe",
      username: "@JoeJoe",
    },
    to: "BUSINESS-PHONE-NUMBER",
    sendTime: "2023-02-22T12:00:00.000Z",
    type: "text",
    text: { body: "OK" },
  },
};

const inboundCtwaAd = {
  ...inboundTextPlain,
  whatsappInboundMessage: {
    ...inboundTextPlain.whatsappInboundMessage,
    referral: {
      source_url: "https://fb.me/xxx",
      source_type: "ad",
      source_id: "MEDIA-ID",
      headline: "Chat with us",
      media_type: "image",
      image_url: "https://scontent.xx.fbcdn.net/v/t45.1600-4/xxx.jpg",
      ctwa_clid:
        "feRgX__yiYtsI1HhjI2FRjyKInYlrU9cm9ml-Yl1MXp_fJy6Mwp-adZ-yLqOWX5CiZJYtjQERgKbAUetcwFXb_6FUYyOl9Kc6HFOBCd",
    },
  },
};

/** Real-world-style ad click (Dari copy, welcome_message, long ctwa_clid) */
const inboundCtwaAdRealShape = {
  id: "evt_69e4a821a7dd0163f1c8faf6",
  type: YCLOUD_WHATSAPP_INBOUND_TYPE,
  apiVersion: "v2",
  createTime: "2026-04-19T10:02:09.778Z",
  whatsappInboundMessage: {
    id: "69e4a821bfdb79211a086233",
    wamid:
      "wamid.HBgLOTM3MDg2MzM0NDcVAgASGCBBQzQ3NDlEMzJCMzQ1N0UzMzQyM0Q3OTA4RjI0NTkzMQA=",
    wabaId: "1413787536842677",
    from: "+93708633447",
    fromUserId: "AF.1052699981265052",
    customerProfile: { name: "Ali M" },
    to: "+93728652889",
    sendTime: "2026-04-19T10:02:07.000Z",
    type: "text",
    text: { body: "السلام علیکم" },
    referral: {
      source_url: "https://fb.me/8Nim62HIS",
      source_type: "ad",
      source_id: "120236523318720395",
      headline: "🚗 کنکشن فوری",
      ctwa_clid:
        "AfigWU4hMRx5ZaIK2l9GFvQegT0WIBETKUyLjjMT93D2dzAG8x98z_bjdFUuijgPFDwCilQeJOUvrgiVB3Wvw_ROGbuI5K5ml6WV6fKPFIdgee5h3uJaDr7IlUY1mPaT5KnTgsFR",
      welcome_message: { text: "السلام علیکم! تشکر" },
    },
  },
};

describe("extractWebhookSessionFields", () => {
  it("parses v2 inbound: digits, name, ISO sendTime, envelope createTime", () => {
    const n = extractWebhookSessionFields(inboundTextPlain);
    expect(n).not.toBeNull();
    expect(n!.phoneNumberDigits).toBe("16315551111");
    expect(n!.name).toBe("Joe");
    expect(n!.sendTime.toISOString()).toBe("2023-02-22T12:00:00.000Z");
    expect(n!.envelopeCreateTime?.toISOString()).toBe(
      "2023-02-22T12:00:00.000Z",
    );
    expect(n!.customerProfile).toMatchObject({ name: "Joe" });
    expect(n!.ctwaClid).toBeNull();
  });

  it("extracts ctwa_clid and referral source fields for CTWA ad", () => {
    const n = extractWebhookSessionFields(inboundCtwaAd);
    expect(n).not.toBeNull();
    expect(n!.ctwaClid).toBe(
      "feRgX__yiYtsI1HhjI2FRjyKInYlrU9cm9ml-Yl1MXp_fJy6Mwp-adZ-yLqOWX5CiZJYtjQERgKbAUetcwFXb_6FUYyOl9Kc6HFOBCd",
    );
    expect(n!.sourceType).toBe("ad");
    expect(n!.sourceId).toBe("MEDIA-ID");
    expect(n!.sourceUrl).toBe("https://fb.me/xxx");
  });

  it("parses real-world ad payload shape (Afghanistan digits, long ctwa_clid)", () => {
    const n = extractWebhookSessionFields(inboundCtwaAdRealShape);
    expect(n).not.toBeNull();
    expect(n!.phoneNumberDigits).toBe("93708633447");
    expect(n!.name).toBe("Ali M");
    expect(n!.ctwaClid).toContain("AfigWU4hMRx5");
    expect(n!.sourceType).toBe("ad");
    expect(n!.sourceId).toBe("120236523318720395");
    expect(n!.customerProfile).toEqual({ name: "Ali M" });
  });
});

const contactCreatedSample = {
  id: "evt_69e4bdf0beea0f616bfbabfd",
  type: "contact.created",
  apiVersion: "v2",
  createTime: "2026-04-19T11:35:12.266Z",
  contactCreated: {
    id: "1862898561365941248",
    nickName: "سلام",
    phoneNumber: "+93786884321",
    countryCode: "AF",
    countryName: "Afghanistan",
    sourceType: "WHATSAPP",
    createTime: "2026-04-19T11:35:12.047Z",
  },
};

describe("extractContactCreatedFields", () => {
  it("parses contact.created: digits, name from nickName, country, createTime", () => {
    const n = extractContactCreatedFields(contactCreatedSample);
    expect(n).not.toBeNull();
    expect(n!.phoneNumberDigits).toBe("93786884321");
    expect(n!.name).toBe("سلام");
    expect(n!.countryCode).toBe("AF");
    expect(n!.countryName).toBe("Afghanistan");
    expect(n!.createTime.toISOString()).toBe("2026-04-19T11:35:12.047Z");
  });
});

describe("inboundContactCreateTimeCandidate", () => {
  it("returns sendTime when envelope is absent", () => {
    const send = new Date("2023-01-01T12:00:00.000Z");
    expect(inboundContactCreateTimeCandidate(send, null)).toEqual(send);
  });

  it("returns the earlier of send and envelope times", () => {
    const send = new Date("2023-01-01T12:00:00.000Z");
    const env = new Date("2023-01-01T11:00:00.000Z");
    expect(inboundContactCreateTimeCandidate(send, env)).toEqual(env);
  });
});

describe("isSupportedYCloudInboundType", () => {
  it("accepts whatsapp.inbound_message.received", () => {
    expect(isSupportedYCloudInboundType(inboundTextPlain)).toBe(true);
  });

  it("returns false for unrelated types when type is set", () => {
    expect(
      isSupportedYCloudInboundType({
        type: "contact.created",
        contactCreated: {},
      }),
    ).toBe(false);
  });

  it("accepts payloads with no type (legacy)", () => {
    expect(
      isSupportedYCloudInboundType({ whatsappInboundMessage: { from: "1" } }),
    ).toBe(true);
  });
});
