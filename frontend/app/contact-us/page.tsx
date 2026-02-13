// app/contact-us/page.tsx
'use client';

import { useState } from 'react';
import { TextField, Button, Box, Typography, Alert } from '@mui/material';

export default function ContactPage() {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    setSubmitted(true);
  };

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', py: 8, px: 2 }}>
      <Typography variant="h4" gutterBottom>
        Contact Us
      </Typography>

      {submitted ? (
        <Alert severity="success">Thank you! We’ll get back to you soon.</Alert>
      ) : (
        <form onSubmit={handleSubmit}>
          <Box mb={2}>
            <TextField
              label="Name"
              name="name"
              fullWidth
              required
              value={formData.name}
              onChange={handleChange}
            />
          </Box>

          <Box mb={2}>
            <TextField
              label="Email"
              name="email"
              type="email"
              fullWidth
              required
              value={formData.email}
              onChange={handleChange}
            />
          </Box>

          <Box mb={3}>
            <TextField
              label="Message"
              name="message"
              multiline
              rows={5}
              fullWidth
              required
              value={formData.message}
              onChange={handleChange}
            />
          </Box>

          <Button variant="contained" color="primary" type="submit" fullWidth>
            Send Message
          </Button>
        </form>
      )}
    </Box>
  );
}
