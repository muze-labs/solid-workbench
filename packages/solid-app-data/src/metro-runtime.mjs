// Browser and test code share Metro's client class and credential stores.
import { Client, client, response } from '@muze-nl/metro-core';
import { oidcStore } from '@muze-nl/metro-oidc';
import { isExpired } from '@muze-nl/metro-oauth2/oauth2';
import { tokenStore } from '@muze-nl/metro-oauth2/tokenstore';
import trace from '@muze-nl/metro-trace';
import { solidApi } from '@muze-labs/metro-solid';

globalThis.metro = {
  Client, client, response, oidcStore, isExpired, tokenStore, trace, solidApi
};
