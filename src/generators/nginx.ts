// src/generators/nginx.ts
import { DeployConfig, NeexProject } from '../types.js';
import { Logger } from '../utils/logger.js';
import { SystemUtils } from '../utils/system.js';

export class NginxGenerator {
  private logger: Logger;
  private system: SystemUtils;

  constructor(logger: Logger, system: SystemUtils) {
    this.logger = logger;
    this.system = system;
  }

  async generate(config: DeployConfig, project: NeexProject): Promise<void> {
    const nginxConfig = this.generateNginxConfig(config, project);
    const configPath = this.getConfigPath(config);
    
    await this.system.writeFile(configPath, nginxConfig);
    this.logger.success(`Nginx configuration generated at ${configPath}`);
    
    // Generate setup instructions
    const instructions = this.generateSetupInstructions(config);
    await this.system.writeFile(
      `${project.rootPath}/nginx-setup.md`,
      instructions
    );
    
    this.logger.info('Check nginx-setup.md for manual setup steps');
  }

  private generateNginxConfig(config: DeployConfig, project: NeexProject): string {
    const clientUpstream = project.hasClient ? `
    upstream client_backend {
        server localhost:${config.clientPort};
    }` : '';

    const serverUpstream = project.hasServer ? `
    upstream server_backend {
        server localhost:${config.serverPort};
    }` : '';

    const clientLocation = project.hasClient ? `
    # Frontend (Next.js)
    location / {
        proxy_pass http://client_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }` : '';

    const serverLocation = project.hasServer ? `
    # Backend API (Express)
    location /api/ {
        proxy_pass http://server_backend/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }` : '';

    return `${clientUpstream}${serverUpstream}

server {
    listen 80;
    server_name ${config.domain} www.${config.domain};
    
    client_max_body_size 100M;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    ${serverLocation}${clientLocation}
    
    # Static files caching
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        ${project.hasClient ? 'proxy_pass http://client_backend;' : ''}
    }
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/javascript application/xml+rss application/json;
}`;
  }

  private getConfigPath(config: DeployConfig): string {
    const os = this.system.getOS();
    
    if (os === 'darwin') {
      return `/usr/local/etc/nginx/servers/${config.projectName}.conf`;
    } else {
      return `/etc/nginx/sites-available/${config.projectName}`;
    }
  }

  private generateSetupInstructions(config: DeployConfig): string {
    const os = this.system.getOS();
    
    const instructions = `# Nginx Setup Instructions

## 1. Install Nginx (if not already installed)

### Ubuntu/Debian:
\`\`\`bash
sudo apt update
sudo apt install nginx
\`\`\`

### CentOS/RHEL:
\`\`\`bash
sudo yum install nginx
\`\`\`

### macOS:
\`\`\`bash
brew install nginx
\`\`\`

## 2. Copy configuration

### Linux:
\`\`\`bash
sudo cp ${this.getConfigPath(config)} /etc/nginx/sites-available/${config.projectName}
sudo ln -s /etc/nginx/sites-available/${config.projectName} /etc/nginx/sites-enabled/
\`\`\`

### macOS:
Configuration is already in the correct location.

## 3. Test and restart Nginx

\`\`\`bash
sudo nginx -t
sudo systemctl restart nginx  # Linux
# or
sudo brew services restart nginx  # macOS
\`\`\`

## 4. Setup SSL (Optional but recommended)

\`\`\`bash
sudo apt install certbot python3-certbot-nginx  # Ubuntu/Debian
sudo certbot --nginx -d ${config.domain}
\`\`\`

## 5. Configure firewall

\`\`\`bash
sudo ufw allow 'Nginx Full'  # Ubuntu/Debian
\`\`\`

Your site will be available at: http://${config.domain}
`;

    return instructions;
  }

  async install(): Promise<void> {
    const hasNginx = await this.system.checkCommand('nginx');
    
    if (!hasNginx) {
      this.logger.warning('Nginx is not installed. Please install it manually:');
      const os = this.system.getOS();
      
      if (os === 'linux') {
        this.logger.info('Ubuntu/Debian: sudo apt install nginx');
        this.logger.info('CentOS/RHEL: sudo yum install nginx');
      } else if (os === 'darwin') {
        this.logger.info('macOS: brew install nginx');
      }
      
      throw new Error('Nginx installation required');
    } else {
      this.logger.success('Nginx already installed');
    }
  }
}