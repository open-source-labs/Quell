// const express = require('express');
import express from 'express';

const app = express();

app.use(express.json());

export = app;