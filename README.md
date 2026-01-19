# CarbonXInsight

## Overview

CarbonXInsight is an internal analytics platform designed to provide real-time market intelligence and pricing analytics for coconut shell charcoal manufacturing and export operations. The application enables data-driven decision-making through comprehensive visualization of production metrics, market trends, and financial performance indicators.

## Business Context

In the competitive landscape of coconut shell charcoal export, timely access to accurate market data and pricing trends is critical for maintaining competitive advantage. CarbonXInsight consolidates disparate data sources into a unified analytics interface, enabling stakeholders to:

- Monitor real-time pricing fluctuations across international markets
- Track production efficiency and capacity utilization
- Analyze export volume trends and seasonal patterns
- Generate executive reports for strategic planning
- Identify cost optimization opportunities

## Problem Statement

Prior to CarbonXInsight, the organization faced several operational challenges:

- **Data Fragmentation**: Market data, production metrics, and financial information existed in isolated systems
- **Manual Reporting**: Executive reports required manual compilation from multiple sources, introducing delays and errors
- **Limited Visibility**: Lack of real-time insights into pricing trends and market conditions
- **Decision Latency**: Strategic decisions were based on outdated or incomplete information
- **Export Complexity**: No streamlined mechanism for generating presentation-ready reports

CarbonXInsight addresses these challenges by providing a centralized, real-time analytics platform with automated reporting capabilities.

## Core Features

### Analytics & Visualization

- **Time-Series Analysis**: Historical trend visualization for pricing, production volume, and market demand
- **Key Performance Indicators**: Real-time dashboard displaying critical business metrics
- **Comparative Analytics**: Side-by-side comparison of performance across time periods, markets, or product lines
- **Interactive Charts**: Drill-down capabilities for detailed exploration of underlying data

### Data Management

- **Automated Data Ingestion**: Scheduled synchronization with production and market data sources
- **Data Validation**: Built-in integrity checks and anomaly detection
- **Historical Data Retention**: Configurable retention policies for trend analysis

### Export & Reporting

- **PDF Report Generation**: High-fidelity export of charts and dashboards
- **Multi-Format Support**: Export to PDF, PNG, and CSV formats
- **Scheduled Reports**: Automated distribution of periodic reports to stakeholders
- **Custom Report Templates**: Configurable layouts for different audiences

## System Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  React Application (SPA)                                  │  │
│  │  - Highcharts Visualization                               │  │
│  │  - Report Generation (html2canvas + jsPDF)                │  │
│  │  - State Management                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTPS/REST
┌───────────────────────────────▼─────────────────────────────────┐
│                      Application Layer                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  FastAPI Backend                                          │  │
│  │  - RESTful API Endpoints                                  │  │
│  │  - Business Logic Layer                                   │  │
│  │  - Data Aggregation & Processing                          │  │
│  │  - Authentication & Authorization                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────────┬─────────────────────────────────┘
                                │ MongoDB Protocol
┌───────────────────────────────▼─────────────────────────────────┐
│                         Data Layer                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  MongoDB Database                                         │  │
│  │  - Time-Series Collections                                │  │
│  │  - Aggregation Pipelines                                  │  │
│  │  - Indexed Queries                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend

- **Framework**: React 18.x
- **Charting Library**: Highcharts
- **Styling**: CSS3 with modular architecture
- **Export Utilities**: 
  - html2canvas for DOM rendering
  - jsPDF for PDF generation
- **HTTP Client**: Axios or Fetch API
- **Build Tool**: Vite or Create React App

### Backend

- **Framework**: FastAPI (Python 3.9+)
- **API Design**: RESTful architecture
- **Data Validation**: Pydantic models
- **Async Processing**: asyncio for concurrent operations
- **CORS**: Configured for internal network access

### Database

- **Primary Store**: MongoDB 5.x+
- **ODM**: Motor (async MongoDB driver) or PyMongo
- **Data Modeling**: Document-oriented schema optimized for analytics queries
- **Indexing**: Compound indexes on time-series and categorical fields

### Deployment

- **Containerization**: Docker
- **Orchestration**: Docker Compose (development) or Kubernetes (production)
- **Reverse Proxy**: Nginx
- **Process Management**: Uvicorn with Gunicorn

## Data Flow

1. **Data Ingestion**
   - External data sources push updates to backend API endpoints
   - Backend validates and normalizes incoming data
   - Processed records are persisted to MongoDB

2. **Query Processing**
   - Frontend requests analytics data via REST endpoints
   - Backend executes MongoDB aggregation pipelines
   - Results are cached and returned as JSON

3. **Visualization**
   - React components consume API responses
   - Highcharts renders interactive visualizations
   - User interactions trigger dynamic re-queries

4. **Report Generation**
   - User initiates export action
   - html2canvas captures rendered DOM elements
   - jsPDF compiles captures into formatted PDF
   - Document is downloaded to client

## Report Generation Workflow

The export functionality follows a multi-stage process:

1. **Capture Phase**: html2canvas traverses the target DOM elements and generates raster images
2. **Composition Phase**: jsPDF creates a new document and positions captured images
3. **Metadata Injection**: Report metadata (timestamp, user, filters) is embedded
4. **Output Generation**: Final PDF is compiled and streamed to the browser

Exported reports include:
- Executive summary with key metrics
- Time-series charts with configurable date ranges
- Comparative analysis tables
- Data source attribution and timestamp

## Project Structure
```
carbonxinsight/
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── charts/
│   │   │   │   ├── TimeSeriesChart.jsx
│   │   │   │   ├── KPIDashboard.jsx
│   │   │   │   └── ComparisonChart.jsx
│   │   │   ├── reports/
│   │   │   │   ├── ReportGenerator.jsx
│   │   │   │   └── ExportButton.jsx
│   │   │   └── layout/
│   │   │       ├── Header.jsx
│   │   │       ├── Sidebar.jsx
│   │   │       └── Footer.jsx
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   └── export.js
│   │   ├── utils/
│   │   │   ├── dateFormatter.js
│   │   │   └── chartConfig.js
│   │   ├── styles/
│   │   │   ├── global.css
│   │   │   └── components.css
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── endpoints/
│   │   │   │   ├── analytics.py
│   │   │   │   ├── reports.py
│   │   │   │   └── data.py
│   │   │   └── router.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── database.py
│   │   ├── models/
│   │   │   ├── market_data.py
│   │   │   └── production.py
│   │   ├── services/
│   │   │   ├── analytics_service.py
│   │   │   └── aggregation_service.py
│   │   └── main.py
│   ├── requirements.txt
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## Installation & Setup

### Prerequisites

- Node.js 16.x or higher
- Python 3.9 or higher
- MongoDB 5.x or higher
- Docker (optional, recommended for production)

### Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with appropriate API_BASE_URL

# Start development server
npm run dev

# Build for production
npm run build
```

The frontend application will be available at `http://localhost:5173` (Vite default).

### Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env with MongoDB connection string and other settings

# Start development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend API will be available at `http://localhost:8000`. API documentation is automatically generated at `http://localhost:8000/docs` (Swagger UI).

### Database Setup
```bash
# Start MongoDB instance
mongod --dbpath /path/to/data/directory

# Or using Docker
docker run -d -p 27017:27017 --name mongodb mongo:5
```

### Docker Deployment
```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Configuration

### Environment Variables

**Frontend (.env)**
```
VITE_API_BASE_URL=http://localhost:8000
VITE_ENABLE_ANALYTICS=true
```

**Backend (.env)**
```
MONGODB_URI=mongodb://localhost:27017
DATABASE_NAME=carbonxinsight
API_PORT=8000
CORS_ORIGINS=http://localhost:5173
LOG_LEVEL=INFO
```

## Intended Usage

CarbonXInsight is designed for internal use by the following stakeholder groups:

- **Executive Leadership**: Strategic decision-making based on market trends and financial performance
- **Operations Managers**: Production planning and capacity optimization
- **Sales Teams**: Pricing strategy and market opportunity identification
- **Finance Department**: Revenue forecasting and cost analysis
- **Business Analysts**: Ad-hoc analysis and custom reporting

The application is accessible only within the corporate network and requires authenticated access. Role-based access controls ensure data confidentiality and segregation of duties.

## Security Considerations

- All API endpoints require authentication tokens
- HTTPS enforced in production environments
- Database credentials stored in secure vault
- Regular security audits and dependency updates
- Audit logging for compliance tracking

## Performance Characteristics

- **Query Response Time**: < 500ms for standard analytics queries
- **Dashboard Load Time**: < 2 seconds for initial render
- **Report Generation**: < 5 seconds for multi-page PDF exports
- **Data Refresh Rate**: Real-time for critical metrics, hourly for historical trends
- **Concurrent Users**: Supports up to 100 simultaneous users

## Future Roadmap

Planned enhancements include:

- **Predictive Analytics**: Machine learning models for demand forecasting and price prediction
- **Mobile Application**: Native iOS and Android apps for executive dashboard access
- **Advanced Alerting**: Configurable thresholds with email and SMS notifications
- **Data Integration**: Connectors for ERP systems and third-party market data providers
- **Collaborative Features**: Shared workspaces and annotated reports
- **API Expansion**: Public API for integration with external business intelligence tools

---

