import {sqliteTable,text,integer,index} from 'drizzle-orm/sqlite-core';
export const progress=sqliteTable('member_progress',{
 userId:text('user_id').primaryKey(),
 level:text('level').notNull().default('Beginner'),
 step:integer('step').notNull().default(0),
 checks:text('checks').notNull().default('{}'),
 completed:integer('completed').notNull().default(0),
 updatedAt:text('updated_at').notNull(),
});
export const copyDrafts=sqliteTable('copy_drafts',{
 userId:text('user_id').primaryKey(),
 content:text('content').notNull(),
 revision:integer('revision').notNull().default(1),
 updatedAt:text('updated_at').notNull(),
});
export const previewAcknowledgements=sqliteTable('preview_acknowledgements',{
 userId:text('user_id').primaryKey(),
 recordId:text('record_id').notNull(),
 typedName:text('typed_name').notNull(),
 termsVersion:text('terms_version').notNull(),
 termsSnapshot:text('terms_snapshot').notNull(),
 termsHash:text('terms_hash').notNull(),
 signedAt:text('signed_at').notNull(),
});
export const visualDrafts=sqliteTable('visual_drafts',{
 userId:text('user_id').primaryKey(),content:text('content').notNull(),revision:integer('revision').notNull().default(1),updatedAt:text('updated_at').notNull(),
});
export const visualSite=sqliteTable('visual_site',{
 id:integer('id').primaryKey(),content:text('content').notNull(),revision:integer('revision').notNull().default(1),updatedAt:text('updated_at').notNull(),
});
export const prototypeSettings=sqliteTable('prototype_settings',{
 id:text('id').primaryKey(),content:text('content').notNull(),revision:integer('revision').notNull().default(1),updatedAt:text('updated_at').notNull(),
});
export const educationEnrolments=sqliteTable('education_enrolments',{
 userId:text('user_id').primaryKey(),reference:text('reference').notNull(),name:text('name').notNull(),pathId:text('path_id').notNull(),answers:text('answers').notNull().default('{}'),snapshot:text('snapshot').notNull(),completed:text('completed').notNull().default('[]'),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
},table=>[index('idx_education_enrolments_updated').on(table.updatedAt)]);
export const chatStudents=sqliteTable('chat_students',{
 id:text('id').primaryKey(),userId:text('user_id').notNull().unique(),name:text('name').notNull(),email:text('email').notNull(),status:text('status').notNull().default('active'),codeHash:text('code_hash').unique(),codeExpires:integer('code_expires').notNull().default(0),createdAt:integer('created_at').notNull(),
});
export const chatSessions=sqliteTable('chat_sessions',{
 hash:text('hash').primaryKey(),studentId:text('student_id').notNull().references(()=>chatStudents.id,{onDelete:'cascade'}),expiresAt:integer('expires_at').notNull(),
},t=>[index('idx_chat_sessions_student').on(t.studentId)]);
export const chatMessages=sqliteTable('chat_messages',{
 seq:integer('seq').primaryKey({autoIncrement:true}),id:text('id').notNull().unique(),studentId:text('student_id').notNull().references(()=>chatStudents.id,{onDelete:'cascade'}),sender:text('sender').notNull(),body:text('body').notNull(),attachmentId:text('attachment_id'),createdAt:integer('created_at').notNull(),
},t=>[index('idx_chat_messages_student_seq').on(t.studentId,t.seq)]);
export const chatState=sqliteTable('chat_state',{
 studentId:text('student_id').notNull().references(()=>chatStudents.id,{onDelete:'cascade'}),role:text('role').notNull(),typingUntil:integer('typing_until').notNull().default(0),readSeq:integer('read_seq').notNull().default(0),
},t=>[index('idx_chat_state_student_role').on(t.studentId,t.role)]);
export const chatLimits=sqliteTable('chat_limits',{
 key:text('key').primaryKey(),count:integer('count').notNull(),expires:integer('expires').notNull(),
});

export const mediaFiles=sqliteTable('media_files',{
 id:text('id').primaryKey(),storageKey:text('storage_key').notNull(),studentId:text('student_id').references(()=>chatStudents.id,{onDelete:'cascade'}),userId:text('user_id').notNull(),scope:text('scope').notNull(),role:text('role').notNull(),name:text('name').notNull(),mime:text('mime').notNull(),size:integer('size').notNull(),createdAt:integer('created_at').notNull(),
},t=>[index('idx_media_files_student').on(t.studentId),index('idx_media_files_user_scope').on(t.userId,t.scope)]);
