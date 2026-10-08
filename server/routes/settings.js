import { Router } from 'express';
import { getSettings, saveSettings } from '../services/settings.js';
import { homeSummary } from '../services/home.js';
import { check } from '../validate.js';

export function settingsRouter(ctx) {
  const r = Router();
  r.get('/', (req, res) => res.json(getSettings(ctx.db)));
  r.put('/', (req, res) => res.json(saveSettings(ctx.db, req.body)));
  return r;
}

export function homeRoute(ctx) {
  return (req, res) => {
    const { today } = check({ today: 'date!' }, req.query);
    res.json(homeSummary(ctx.db, today));
  };
}
