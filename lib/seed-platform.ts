import sql from './db';

export async function seedPlatform() {
  // Ensure core companies exist before seeding boards/channels
  await sql`
    INSERT INTO companies (name, slug, type, color, logo_initials, ownership_pct, stripe_enabled)
    VALUES ('CreatorRate', 'creatorrate', 'saas', '#f43f5e', 'CR', 25, false)
    ON CONFLICT (slug) DO NOTHING
  `;
  // Seed kanban boards + columns per company
  const companies = await sql`SELECT id, slug FROM companies`;
  const admins = await sql`SELECT id FROM users WHERE role = 'ADMIN'`;

  for (const company of companies) {
    const isGroup = company.slug === 'group';
    const colNames = isGroup
      ? ['To do', 'In progress', 'Done']
      : ['Need', 'Nice', 'In progress', 'Done'];

    // Check if board already exists for this company (no owner)
    const [existing] = await sql`
      SELECT id FROM kanban_boards WHERE company_id = ${company.id} AND owner_user_id IS NULL LIMIT 1
    `;
    let boardId: number;
    if (existing) {
      boardId = existing.id;
    } else {
      const [board] = await sql`
        INSERT INTO kanban_boards (company_id, name)
        VALUES (${company.id}, ${isGroup ? 'Group board' : 'Fælles board'})
        RETURNING id
      `;
      boardId = board.id;

      for (let pos = 0; pos < colNames.length; pos++) {
        await sql`
          INSERT INTO kanban_columns (board_id, name, position)
          VALUES (${boardId}, ${colNames[pos]}, ${pos})
        `;
      }
    }
  }

  // Seed #general channels per company
  for (const company of companies) {
    const [existingChannel] = await sql`
      SELECT id FROM channels WHERE company_id = ${company.id} AND is_general = true LIMIT 1
    `;
    let channelId: number;
    if (existingChannel) {
      channelId = existingChannel.id;
    } else {
      const [channel] = await sql`
        INSERT INTO channels (company_id, name, description, is_general, created_by)
        VALUES (${company.id}, 'general', 'Generel kanal', true, ${admins[0]?.id ?? null})
        RETURNING id
      `;
      channelId = channel.id;
    }

    // Add admins as members of all channels
    for (const admin of admins) {
      await sql`
        INSERT INTO channel_members (channel_id, user_id)
        VALUES (${channelId}, ${admin.id})
        ON CONFLICT DO NOTHING
      `;
    }
  }

  return { ok: true };
}
